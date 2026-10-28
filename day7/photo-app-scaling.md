# SnapShare Photo-App Scaling Plan

## 1. Assumptions

The following assumptions guide the initial capacity estimates:

- SnapShare has 10 million registered users.
- 10% of registered users are active each day.
- Each daily active user uploads one photo per day and views 50 feed pages per day.
- Each original photo averages 2 MB, and each photo generates one 50 KB thumbnail.
- The system operates 24 hours per day and 365 days per year.
- Average request rates are calculated across the full day. Peak feed traffic is estimated at five times the average rate.
- Storage estimates use decimal units: 1 TB = 1,000,000 MB. They exclude backups, replication, database records, and operational overheads.
- These estimates are a planning baseline. Actual traffic varies with user behaviour and time of day.

## 2. Capacity Calculations

### Daily active users

Daily active users (DAU) are calculated as:

DAU = 10,000,000 × 0.10 = **1,000,000 users per day**.

### Photo uploads per second

Daily uploads = 1,000,000 users × 1 photo = **1,000,000 uploads/day**.

Average uploads per second = 1,000,000 ÷ 86,400 = **11.57 uploads/second**, or approximately 12.

### Feed views per second

Daily feed views = 1,000,000 users × 50 views = **50,000,000 views/day**.

Average feed views per second = 50,000,000 ÷ 86,400 = **578.70 views/second**, or approximately 579.

Estimated peak feed views per second = 578.70 × 5 = **2,893.52 views/second**, or approximately 2,894.

These figures estimate feed-page requests. Each feed page may also trigger separate metadata and image requests, which should be measured when planning production capacity.

### Annual photo storage

Original photos:

1,000,000 photos/day × 2 MB × 365 days = 730,000,000 MB = **730 TB/year**.

Thumbnails:

1,000,000 thumbnails/day × 0.05 MB × 365 days = 18,250,000 MB = **18.25 TB/year**.

Total new photo storage per year:

730 TB + 18.25 TB = **748.25 TB/year**.

This represents new storage added annually, assuming all photos and thumbnails are retained. It excludes backups, replication, and additional operational overheads.

## 3. Is SnapShare Read-Heavy or Write-Heavy?

SnapShare is a **read-heavy system**. Each active user views 50 feed pages but uploads only one photo per day, producing approximately 50 million daily feed views compared with one million daily uploads—a 50:1 ratio.

The architecture should therefore prioritize fast feed delivery. A content delivery network (CDN) can serve frequently accessed images close to users, a cache can reduce repeated database queries, and a database read replica can handle suitable read queries separately from writes. Uploads should also be processed asynchronously so thumbnail generation does not delay the upload response.

## 4. Why Photos Should Not Be Stored Inside the Database

Original photos and thumbnails should be stored in object storage rather than directly inside database tables. At an estimated 748.25 TB of new photo data per year, storing binary files in the database would increase database size, backup duration, and restoration complexity.

Object storage is designed for large files and can scale independently of the database. The database should instead store metadata such as photo ID, owner ID, caption, upload time, processing status, and object-storage key. This keeps database records relatively small and makes photo information easier to query and manage.

## 5. Architecture Diagram

```text
                         +------------------+
                         |      Users       |
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
                         +------------------+         |
                         | Job Queue        |         |
                         | Thumbnail jobs   |         |
                         +--------+---------+         |
                                  |                   |
                                  v                   |
                         +------------------+         |
                         | Thumbnail Worker|---------+
                         +------------------+
```

The diagram shows the main logical components. The CDN serves cached images directly and retrieves uncached images from object storage or a configured origin. App servers manage application logic and metadata, while the queue and worker process thumbnail jobs asynchronously.

## 6. What Each Component Solves

- **CDN:** Delivers cached photos from locations closer to users, reducing image-loading latency and requests reaching the origin.
- **Load balancer:** Distributes incoming requests across healthy app servers to prevent one server from becoming overloaded and to support horizontal scaling.
- **App servers:** Handle authentication, application logic, photo-upload requests, feed generation, and communication with other services.
- **Cache:** Stores frequently accessed feed data and metadata, reducing repeated database queries and improving response times.
- **Primary database:** Stores structured records such as users, follows, photo metadata, and feed-related records, and handles writes.
- **Read replica:** Serves suitable read queries so feed and metadata reads put less pressure on the primary database.
- **Object storage:** Stores original photos and generated thumbnails durably and independently of the database.
- **Job queue:** Holds thumbnail-generation jobs so uploads can complete without waiting for image processing.
- **Thumbnail worker:** Retrieves queued jobs, creates smaller thumbnail images, saves them to object storage, and updates processing status.

## 7. Step-by-Step Photo Upload Flow

1. **Photo selection:** A user selects a photo in the SnapShare application and submits it for upload.
2. **Request routing:** The load balancer routes the request to a healthy app server.
3. **Authentication and validation:** The app server verifies the user's identity and checks that the file type and size meet the application's rules.
4. **Original image storage:** The original photo is uploaded to object storage, which confirms storage and provides an object key.
5. **Metadata creation:** The app server saves the photo's metadata and object key in the primary database, marking the photo as awaiting thumbnail processing.
6. **Job creation:** The app server publishes a thumbnail-generation job to the queue, including the photo ID and object key.
7. **Upload response:** The application confirms that the original photo has been uploaded without waiting for thumbnail generation to finish. The interface can display a placeholder while processing continues.
8. **Job processing:** A thumbnail worker retrieves the job and reads the original photo from object storage.
9. **Thumbnail generation:** The worker creates the smaller thumbnail and saves it to object storage using a separate object key.
10. **Status update:** The worker updates the photo record in the primary database to indicate that thumbnail processing is complete and records the thumbnail key.
11. **Feed delivery:** When a user views a feed, the application retrieves photo metadata through the cache or an appropriate database read. The CDN serves available images, while the application can show a placeholder if a thumbnail is not ready.

### Handling failures

If thumbnail processing fails, the queue should support retries. After repeated failures, the job can be moved to a dead-letter queue for investigation. Jobs should be idempotent, meaning processing the same job more than once does not create incorrect duplicate results. The original photo should remain stored even when thumbnail processing is delayed.

If the original image is stored successfully but saving its metadata or publishing the job fails, the application needs a recovery mechanism, such as retrying the operation or reconciling stored objects with database records. This reduces the risk of orphaned files or photos that never receive thumbnails.

## 8. Engineering Trade-Offs

### Trade-off 1: Caching versus data freshness

Caching feed data reduces database load and improves response times. However, cached feeds may briefly show outdated information after a user uploads a photo or follows another user.

**Decision:** Use appropriate cache expiration times and targeted invalidation when important changes occur. This balances fast responses against the need to show recent content.

### Trade-off 2: Asynchronous thumbnail generation versus immediate availability

A queue allows the original upload to complete quickly and prevents image processing from slowing down app servers. However, the thumbnail may not be available immediately.

**Decision:** Confirm the original upload first, show a placeholder while the thumbnail is being generated, and retry failed jobs. This improves responsiveness while accepting a short delay in thumbnail availability.

### Trade-off 3: Read replicas versus consistency

Read replicas allow the system to handle more feed and metadata queries, but updates from the primary database may take time to reach a replica. A newly uploaded photo might therefore not appear immediately in a feed served using replica data.

**Decision:** Use replicas for ordinary read traffic, but direct reads that require immediate confirmation to the primary database or use another mechanism to ensure the recent update is visible.

### Trade-off 4: Object storage and CDN versus operational cost

Object storage and a CDN provide scalable image storage and fast delivery, but storage capacity, data transfer, and CDN requests incur costs.

**Decision:** Use image compression where appropriate, caching, lifecycle policies, and sensible deletion policies to control costs without sacrificing image availability or quality unnecessarily.

## 9. Conclusion

SnapShare should use horizontally scalable app servers, a load balancer, caching, a primary database with a read replica, object storage, a CDN, and a queue-based thumbnail worker.

The estimates indicate one million daily active users, approximately 12 uploads per second, 579 average feed views per second, and an estimated peak of about 2,894 feed views per second. The design prioritizes read performance while processing photo uploads and thumbnails asynchronously. Explicit failure handling, processing status, retry mechanisms, and consistency-aware reads help make the architecture more reliable under heavy load.