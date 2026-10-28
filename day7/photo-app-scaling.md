# SnapShare: Scaling Plan

## 1. Assumptions

The following assumptions are used for the initial capacity estimates:

- SnapShare has 10 million registered users.
- 10% of registered users are active each day.
- Each daily active user uploads one photo per day and views 50 feed pages per day.
- Each original photo averages 2 MB, and each photo generates one 50 KB thumbnail.
- The system operates 24 hours per day and 365 days per year.
- Average request rates are calculated across the full day. Peak feed traffic is estimated at five times the average rate.
- Storage estimates use decimal units: 1 TB = 1,000,000 MB. They exclude backups, replication, database records, and other operational overheads.

### Daily active users

Daily active users (DAU) are 10% of 10 million registered users:

DAU = 10,000,000 × 0.10 = **1,000,000 users per day**.

## 2. Traffic and Storage Estimates

There are 86,400 seconds in a day.

### Photo uploads per second

- Daily uploads = 1,000,000 users × 1 photo = 1,000,000 uploads.
- Average uploads per second = 1,000,000 ÷ 86,400 = **11.57 uploads/second**, or approximately 12.

### Feed views per second

- Daily feed views = 1,000,000 users × 50 views = 50,000,000 views.
- Average feed views per second = 50,000,000 ÷ 86,400 = **578.70 views/second**, or approximately 579.
- Peak feed views per second = 578.70 × 5 = **2,893.52 views/second**, or approximately 2,894.

These figures represent average and estimated peak request rates. Actual traffic may vary by time of day and user behaviour.

### Annual photo storage

**Original photos**

- Annual original photos = 1,000,000 × 365 = 365,000,000 photos.
- Annual original storage = 365,000,000 × 2 MB = 730,000,000 MB = **730 TB/year**.

**Thumbnails**

- Annual thumbnails = 365,000,000 thumbnails.
- Annual thumbnail storage = 365,000,000 × 50 KB = 18,250,000,000 KB = **18.25 TB/year**.

**Total annual photo storage**

730 TB + 18.25 TB = **748.25 TB/year**.

This estimate assumes photos and thumbnails are retained for a full year and does not include additional copies created by backups or replication.

## 3. Read-Heavy or Write-Heavy?

SnapShare is a **read-heavy system**. Each active user views 50 feed pages but uploads only one photo daily, resulting in approximately 50 million daily feed views compared with one million daily uploads.

The architecture should therefore prioritize fast feed delivery. A content delivery network (CDN) can serve frequently accessed photos close to users, a cache can reduce repeated database queries, and a database read replica can handle read traffic separately from writes. Uploads should also be processed asynchronously where possible so thumbnail generation does not delay the user's upload response.

## 4. Why Photos Should Not Be Stored Inside the Database

Original photos and thumbnails should be stored in object storage rather than directly inside database tables. At an estimated 748.25 TB of new photo data per year, storing binary files in the database would increase database size, backup duration, and restoration complexity. Object storage is designed for large files and can scale independently from the database. The database should store metadata such as photo ID, owner ID, caption, upload time, and object-storage key or URL.

## 5. Architecture Diagram

```text
                         +------------------+
                         |      Users       |
                         +--------+---------+
                                  |
                                  v
                         +------------------+
                         |       CDN        |
                         | Cached photos    |
                         +--------+---------+
                                  |
                                  v
                         +------------------+
                         |  Load Balancer   |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |             |             |
                    v             v             v
              +-----------+ +-----------+ +-----------+
              | App       | | App       | | App       |
              | Server 1  | | Server 2  | | Server N  |
              +-----+-----+ +-----+-----+ +-----+-----+
                    |             |             |
                    +-------------+-------------+
                                  |
                 +----------------+----------------+
                 |                |                |
                 v                v                v
          +-------------+  +-------------+  +---------------+
          | Cache       |  | Primary DB  |  | Object Storage|
          | Feed/data   |  | Reads/Writes|  | Original      |
          +-------------+  +------+------+  | photos        |
                                    |         +-------+-------+
                                    v                 |
                             +-------------+          |
                             | Read Replica|          |
                             | Read queries|          |
                             +-------------+          |
                                                      |
                         Upload event                 |
                    +------------------+              |
                    |      Queue       |              |
                    | Thumbnail jobs   |              |
                    +--------+---------+              |
                             |                        |
                             v                        |
                    +------------------+              |
                    | Thumbnail Worker|--------------+
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Thumbnail saved  |
                    | to object storage|
                    +------------------+
```

The diagram is a logical view. In a production system, the CDN serves cached image files directly from object storage or an origin configured to use object storage. App servers use the database for metadata, while the queue and worker handle thumbnail processing asynchronously.

## 6. What Each Component Solves

- **CDN:** Delivers cached photos from locations closer to users, reducing image-loading latency and traffic reaching the origin.
- **Load balancer:** Distributes incoming requests across multiple app servers to avoid overloading one server and to support horizontal scaling.
- **App servers:** Handle application logic, authentication, photo-upload requests, feed generation, and interactions with other services.
- **Cache:** Stores frequently accessed feed data and metadata to reduce repeated database queries and improve response times.
- **Primary database:** Stores structured data such as users, follows, photo metadata, and feed-related records, and handles writes.
- **Read replica:** Serves suitable read queries so that feed and metadata reads put less pressure on the primary database.
- **Object storage:** Stores original photos and generated thumbnails durably, independently of the database.
- **Queue:** Holds thumbnail-generation jobs so uploads can complete without waiting for image processing.
- **Thumbnail worker:** Consumes queued jobs, creates smaller thumbnail images, and saves them to object storage.

## 7. Photo Upload Flow

1. A user selects a photo and submits it through the app.
2. The load balancer routes the request to a healthy app server.
3. The app server authenticates the user and validates the request, including the file type and size.
4. The original photo is uploaded to object storage, which returns or confirms its storage key.
5. The app server saves the photo metadata and storage key in the primary database.
6. The app server places a thumbnail-generation job on the queue.
7. The app confirms the upload to the user without waiting for thumbnail generation to finish.
8. A thumbnail worker retrieves the queued job and reads the original photo from object storage.
9. The worker creates a 50 KB thumbnail and saves it to object storage.
10. The worker updates the photo metadata or processing status in the database.
11. When a user views a feed, the app retrieves feed metadata using the cache and/or database, while the CDN serves available original photos or thumbnails.

If a thumbnail job fails, it should be retried safely or moved to a dead-letter queue for investigation. The original photo should remain available even when thumbnail processing is delayed.

## 8. Trade-Offs

### Trade-off 1: Caching versus data freshness

Caching feed data reduces database load and improves response time. However, a cached feed may briefly show outdated information after a user uploads a photo or follows someone. Short cache expiration times and targeted cache invalidation can balance speed with freshness.

### Trade-off 2: Asynchronous thumbnail generation versus immediate availability

Using a queue allows uploads to finish quickly and prevents image processing from slowing app servers. However, thumbnails may not be available immediately after upload. The app can show a placeholder until the thumbnail is ready and retry failed jobs.

### Trade-off 3: Database read replicas versus consistency

Read replicas help handle high read traffic, but replication can lag behind the primary database. A newly uploaded photo might not appear immediately in queries served by a replica. The app can read recent changes from the primary database when immediate consistency is important.

### Trade-off 4: Object storage and CDN versus operational cost

Object storage and a CDN provide scalable file storage and fast delivery, but storage, data transfer, and CDN requests incur costs. Lifecycle policies, thumbnail optimization, caching, and deletion of unwanted photos can help control expenses.

## 9. Conclusion

SnapShare should use horizontally scalable app servers, a load balancer, caching, a database with a read replica, object storage, a CDN, and a queue-based thumbnail worker. The estimated one million daily active users generate approximately 12 uploads per second and 579 average feed views per second, with estimated peak feed traffic of about 2,894 views per second. The design prioritizes read performance while processing photo uploads and thumbnails reliably and asynchronously.
