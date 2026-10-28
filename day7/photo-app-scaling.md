# SnapShare: Scaling Plan

## 1. Assumptions

The following assumptions guide the initial capacity estimates:

- SnapShare has 10 million registered users.
- 10% of registered users are active daily.
- Each daily active user uploads one photo and views 50 feed pages per day.
- Each original photo averages 2 MB, and each photo generates one 50 KB thumbnail.
- The system operates 24 hours per day and 365 days per year.
- Average request rates are calculated across the full day. Peak feed traffic is estimated at five times the average rate.
- Storage estimates use decimal units: 1 TB = 1,000,000 MB. They exclude backups, replication, database records, and operational overheads.
- The estimates represent a planning baseline. Actual traffic will vary with user behaviour and time of day.

### Daily active users

Daily active users (DAU) are calculated as:

DAU = 10,000,000 × 0.10 = **1,000,000 users per day**.

## 2. Traffic and Storage Estimates

There are 86,400 seconds in a day.

### Photo uploads per second

- Daily uploads = 1,000,000 users × 1 photo = 1,000,000 uploads.
- Average uploads per second = 1,000,000 ÷ 86,400 = **11.57 uploads/second**, or approximately 12.

### Feed views per second

- Daily feed views = 1,000,000 users × 50 views = 50,000,000 views.
- Average feed views per second = 50,000,000 ÷ 86,400 = **578.70 views/second**, or approximately 579.
- Estimated peak feed views per second = 578.70 × 5 = **2,893.52 views/second**, or approximately 2,894.

These figures describe average and estimated peak request rates. Feed-page requests may also trigger multiple metadata and image requests, so production capacity planning should measure those separately.

### Annual photo storage

**Original photos**

- Annual original photos = 1,000,000 × 365 = 365,000,000 photos.
- Annual original storage = 365,000,000 × 2 MB = 730,000,000 MB = **730 TB/year**.

**Thumbnails**

- Annual thumbnails = 365,000,000 thumbnails.
- Annual thumbnail storage = 365,000,000 × 50 KB = 18,250,000,000 KB = **18.25 TB/year**.

**Total annual photo storage**

730 TB + 18.25 TB = **748.25 TB/year**.

This estimate assumes photos and thumbnails are retained for a full year. It excludes backups, replication, and additional operational overheads. It is the amount of new storage added annually, not the total storage needed for all future years.

## 3. Is SnapShare Read-Heavy or Write-Heavy?

SnapShare is a **read-heavy system**. Each active user views 50 feed pages but uploads only one photo per day. This produces approximately 50 million daily feed views compared with one million daily uploads—a 50:1 ratio.

The architecture should therefore prioritize fast feed delivery. A content delivery network (CDN) can serve frequently accessed images close to users, a cache can reduce repeated database queries, and a database read replica can handle suitable read queries separately from writes. Uploads should also be processed asynchronously where possible so thumbnail generation does not delay the upload response.

## 4. Why Photos Should Not Be Stored Inside the Database

Original photos and thumbnails should be stored in object storage rather than directly inside database tables. At an estimated 748.25 TB of new photo data per year, storing binary files in the database would increase database size, backup duration, and restoration complexity.

Object storage is designed for large files and can scale independently of the database. The database should instead store metadata such as photo ID, owner ID, caption, upload time, processing status, and object-storage key. This keeps database records relatively small and makes it easier to query and manage photo information.

## 5. Architecture Diagram

```text
                         +------------------+
                         |       Users      |
                         +--------+---------+
                                  |
                                  v
                         +------------------+
                         |       CDN        |
                         |  Cached images   |
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
               +---------+   +---------+   +---------+
               | App     |   | App     |   | App     |
               | Server 1|   | Server 2|   | Server N|
               +----+----+   +----+----+   +----+----+
                    |             |             |
                    +-------------+-------------+
                                  |
                 +----------------+----------------+
                 |                |                |
                 v                v                v
           +-----------+   +-------------+   +----------------+
           | Cache     |   | Primary DB  |   | Object Storage |
           | Feed data |   | Metadata    |   | Original photos|
           +-----------+   +------+------+   | and thumbnails |
                                  |          +--------+-------+
                                  v                   ^
                           +-------------+            |
                           | Read Replica|            |
                           | Read queries|            |
                           +-------------+            |
                                                      |
                           +------------------+       |
                           | Job Queue        |       |
                           | Thumbnail jobs   |       |
                           +--------+---------+       |
                                    |                 |
                                    v                 |
                           +------------------+       |
                           | Thumbnail Worker |-------+
                           +------------------+
```

The diagram shows the main logical components and their relationships. In production, the CDN should retrieve images from object storage or a configured origin. App servers use the database for metadata, while the queue and worker process thumbnail jobs asynchronously. The worker reads the original image from object storage and saves the generated thumbnail back to object storage.

## 6. What Each Component Solves

- **CDN:** Delivers cached images from locations closer to users, reducing image-loading latency and requests reaching the origin.
- **Load balancer:** Distributes incoming requests across healthy app servers to prevent one server from becoming overloaded and to support horizontal scaling.
- **App servers:** Handle authentication, application logic, upload requests, feed generation, and communication with the database and other services.
- **Cache:** Stores frequently requested feed data and metadata, reducing repeated database queries and improving response times.
- **Primary database:** Stores structured records such as users, follows, photo metadata, and other application data while handling writes.
- **Read replica:** Serves suitable read queries, reducing pressure on the primary database; replication lag must be considered for newly written data.
- **Object storage:** Stores original photos and thumbnails durably and independently of the database, allowing image storage to scale as the collection grows.
- **Job queue:** Holds thumbnail-generation jobs until workers can process them, allowing uploads to finish without waiting for image processing.
- **Thumbnail worker:** Retrieves queued jobs, reads the original image, generates a smaller thumbnail, stores it, and updates processing status.

## 7. Step-by-Step Photo Upload Flow

1. **Photo selection:** A user selects a photo in the SnapShare application and submits it for upload.
2. **Request routing:** The load balancer routes the request to a healthy app server.
3. **Authentication and validation:** The app server verifies the user's identity and checks that the file type and size meet the application's rules.
4. **Original image storage:** The original photo is uploaded to object storage, which confirms that the file has been stored and provides its object key.
5. **Metadata creation:** The app server saves the photo's metadata and object key in the primary database, marking the photo as awaiting thumbnail processing.
6. **Job creation:** The app server publishes a thumbnail-generation job to the queue, including the photo ID and object key.
7. **Upload response:** The application confirms that the original photo has been uploaded without waiting for thumbnail generation to finish. The interface can display a placeholder while processing continues.
8. **Job processing:** A thumbnail worker retrieves the job and reads the original photo from object storage.
9. **Thumbnail generation:** The worker creates the smaller thumbnail and saves it to object storage using a separate object key.
10. **Status update:** The worker updates the photo record in the primary database to indicate that thumbnail processing is complete and records the thumbnail key.
11. **Feed delivery:** When a user views a feed, the application retrieves photo metadata through the cache or an appropriate database read. The CDN serves available images, while the application can show a placeholder if a thumbnail is not ready.

### Handling failures

If thumbnail processing fails, the queue should support retries. After repeated failures, the job can be moved to a dead-letter queue for investigation. Jobs should be designed to be idempotent, meaning that processing the same job more than once does not create incorrect duplicate results. The original photo should remain stored even when thumbnail processing is delayed.

If the original image is stored successfully but saving its metadata or publishing the job fails, the application needs a recovery mechanism, such as retrying the operation or reconciling stored objects with database records. This reduces the risk of orphaned files or photos that never receive thumbnails.

## 8. Engineering Trade-Offs

### Trade-off 1: Caching versus data freshness

Caching feed data reduces database load and improves response times. However, cached feeds may briefly show outdated information after a user uploads a photo or follows another user.

**Decision:** Use appropriate cache expiration times and targeted invalidation when important changes occur. This balances fast responses against the need to show recent content.

### Trade-off 2: Asynchronous thumbnail generation versus immediate availability

A queue allows the original upload to complete quickly and prevents image processing from slowing down the app servers. However, the thumbnail may not be available immediately.

**Decision:** Confirm the original upload first, show a placeholder while the thumbnail is being generated, and retry failed jobs. This improves responsiveness while accepting a short delay in thumbnail availability.

### Trade-off 3: Read replicas versus consistency

Read replicas allow the system to handle more feed and metadata queries, but updates from the primary database may take time to reach a replica. A newly uploaded photo might therefore not appear immediately in a feed served using replica data.

**Decision:** Use replicas for ordinary read traffic, but direct reads that require immediate confirmation to the primary database or use another mechanism to ensure the recent update is visible.

### Trade-off 4: Object storage and CDN versus operational cost

Object storage and a CDN provide scalable image storage and fast delivery, but storage capacity, data transfer, and CDN requests incur costs.

**Decision:** Use image compression where appropriate, caching, lifecycle policies, and deletion policies to control costs without sacrificing image availability or quality unnecessarily.

## 9. Conclusion

SnapShare should use horizontally scalable app servers, a load balancer, caching, a primary database with a read replica, object storage, a CDN, and a queue-based thumbnail worker. The estimates indicate one million daily active users, approximately 12 uploads per second, 579 average feed views per second, and an estimated peak of about 2,894 feed views per second.

The design prioritizes read performance while processing photo uploads and thumbnails asynchronously. Explicit failure handling, processing status, retry mechanisms, and consistency-aware reads help make the architecture more reliable under heavy load.
