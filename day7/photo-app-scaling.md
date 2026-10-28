# SnapShare Photo-App Scaling Plan

## Overview

SnapShare is a photo-sharing application designed to support 10 million registered users. This document estimates its expected workload, proposes a scalable architecture, explains the data flow, and identifies the main trade-offs and monitoring requirements.

## 1. Assumptions and Daily Active Users

The following assumptions are used for planning. These are estimates for a hypothetical application, not actual production measurements.

| Assumption | Value |
|---|---:|
| Registered users | 10,000,000 |
| Daily active users (DAU) | 10% of registered users |
| Daily active users calculated | 1,000,000 |
| Photo uploads per active user per day | 1 |
| Feed page views per active user per day | 50 |
| Average original photo size | 2 MB |
| Average thumbnail size | 50 KB |
| Seconds per day | 86,400 |
| Peak traffic multiplier | 5× |
| Days per year | 365 |

Daily active users are calculated as:

DAU = 10,000,000 × 10% = 1,000,000 users per day.

For this estimate, each active user uploads one photo and views 50 feed pages per day. Actual traffic will vary by time of day and user behaviour.

## 2. Daily Traffic and Storage Estimates

### A. Photo uploads

Daily uploads:

1,000,000 active users × 1 upload = 1,000,000 uploads per day.

Average upload requests per second:

1,000,000 ÷ 86,400 = approximately 11.57 uploads per second.

Estimated peak upload requests per second:

11.57 × 5 = approximately 57.87 uploads per second.

### B. Feed views

Daily feed page views:

1,000,000 active users × 50 views = 50,000,000 feed views per day.

Average feed requests per second:

50,000,000 ÷ 86,400 = approximately 578.70 requests per second.

Estimated peak feed requests per second:

578.70 × 5 = approximately 2,893.52 requests per second.

Feed traffic is expected to be much higher than upload traffic. Therefore, SnapShare is primarily a read-heavy application.

### C. Original photo storage

Daily original photo storage:

1,000,000 uploads × 2 MB = 2,000,000 MB = 2 TB per day.

Annual original photo storage:

2 TB × 365 = 730 TB per year.

### D. Thumbnail storage

Daily thumbnail storage:

1,000,000 uploads × 50 KB = 50,000,000 KB = 50 GB per day.

Annual thumbnail storage:

50 GB × 365 = 18.25 TB per year.

### E. Total estimated photo storage

| Storage category | Daily storage | Annual storage |
|---|---:|---:|
| Original photos | 2 TB | 730 TB |
| Thumbnails | 50 GB | 18.25 TB |
| Total | 2.05 TB | 748.25 TB |

These calculations use decimal storage units. They exclude database storage, backups, replication, temporary files, and storage overhead. Actual costs will depend on retention policies, compression, image formats, and the number of image variants stored.

## 3. Read-Heavy vs. Write-Heavy Workload

SnapShare is expected to be read-heavy because users view feeds more frequently than they upload photos.

The daily ratio is:

50,000,000 feed views ÷ 1,000,000 uploads = 50:1.

This means the application handles approximately 50 feed page views for every photo upload under the stated assumptions.

The architecture should therefore prioritise efficient photo delivery, caching, database read performance, and horizontal scaling of application servers.

## 4. Why Object Storage Is Suitable for Photos

Photo files should be stored in object storage rather than directly inside relational database tables.

Object storage is suitable because it:

- Handles large volumes of image files efficiently.
- Scales to hundreds of terabytes or more.
- Offers durability and availability features.
- Separates image storage from application and database workloads.
- Integrates with content delivery networks (CDNs).
- Allows storage costs and access policies to be managed separately.

A relational database should store photo metadata, such as the photo ID, owner ID, object-storage key, upload timestamp, and processing status.

This separation keeps the database focused on structured information while object storage manages the image files.

## 5. Proposed Scalable Architecture

```text
                         +----------------------+
                         |   Mobile/Web Users   |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |          CDN         |
                         | Cached Photos/Images |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |    Load Balancer     |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |   App Server Pool    |
                         | Horizontally Scaled  |
                         +---+-------------+----+
                             |             |
                 +-----------+             +----------------+
                 |                                            |
                 v                                            v
       +----------------------+                   +----------------------+
       |   Primary Database   |                   |    Object Storage    |
       | Metadata and Writes  |                   | Original Photos and  |
       +----------+-----------+                   | Thumbnails           |
                  |                               +----------+-----------+
                  v                                          ^
       +----------------------+                              |
       |    Read Replica      |                              |
       | Feed/Metadata Reads  |                              |
       +----------------------+                              |
                                                             |
       +----------------------+                   +----------+-----------+
       |       Cache          |                   |   Thumbnail Worker   |
       | Frequently Used Data |                   | Processes Queue Jobs |
       +----------------------+                   +----------+-----------+
                                                             ^
                                                             |
                                                  +----------+-----------+
                                                  |      Job Queue       |
                                                  +----------------------+

                  +-------------------------------------------+
                  | Monitoring, Logging and Alerting          |
                  | Tracks Errors, Latency, Traffic and Health |
                  +-------------------------------------------+
```

## 6. Explanation of the Main Components

### A. Content Delivery Network (CDN)

The CDN caches and delivers frequently accessed images from locations closer to users.

This reduces latency, decreases repeated requests to the origin storage, and improves the user experience.

### B. Load balancer

The load balancer distributes incoming application requests across multiple application servers.

It prevents a single server from handling all requests and supports scaling when traffic increases.

### C. Application servers

Application servers handle authentication, upload requests, feed generation, permissions, and other business logic.

They should be stateless where practical so additional instances can be added or removed according to demand.

### D. Object storage

Object storage holds original photos and generated thumbnails.

Each image is referenced by a unique object key. Access controls should prevent unauthorised users from accessing private photos.

### E. Job queue

The queue holds background-processing jobs, such as thumbnail generation.

It separates the upload process from image processing, helping the application respond promptly without requiring every task to finish immediately.

### F. Thumbnail workers

Workers consume queued jobs, generate smaller image versions, and update the photo's processing status.

More workers can be added when the queue grows.

### G. Primary database and read replica

The primary database handles metadata writes, including new photo records and processing-status updates.

A read replica can serve suitable read queries, reducing the workload on the primary database. Replication lag must be considered.

### H. Cache

A cache stores frequently requested information, such as feed metadata and popular content references.

This reduces repeated database queries. Cache expiration and invalidation rules are needed to prevent users from seeing stale information.

### I. Monitoring and alerting

Monitoring tools track traffic, latency, errors, server health, queue depth, storage growth, and database performance.

Alerts notify the engineering team when important thresholds are exceeded.

## 7. Photo Upload and Delivery Data Flow

The following sequence describes how a photo moves through the system.

1. **User selects a photo:** The mobile or web application sends an upload request.
2. **Validate the request:** The application checks authentication, file type, file size, and upload permissions.
3. **Store the original:** The application uploads the original image to object storage, ideally using a secure upload mechanism such as a pre-signed URL where appropriate.
4. **Save metadata:** The application creates a database record containing the photo ID, owner ID, object key, upload time, and `PROCESSING` status.
5. **Queue the processing job:** A thumbnail-generation job is placed on the queue using a reliable publishing mechanism.
6. **Acknowledge the upload:** The application confirms that the original has been stored and the required metadata has been recorded. Thumbnail processing may still be underway.
7. **Generate the thumbnail:** A worker retrieves the job, reads the original image, creates the thumbnail, and stores it in object storage.
8. **Update the database:** After successful processing, the worker changes the photo status to `READY` and records the thumbnail location.
9. **Deliver the image:** When users view the feed, the application retrieves the relevant metadata and the CDN delivers the image when available in its cache.
10. **Handle failures:** Failed jobs are retried. Repeated failures go to a dead-letter queue for investigation. A reconciliation process identifies uploads stuck in `PROCESSING`.

The system should also handle cases where the original is stored but metadata creation fails, or metadata is saved but queue publishing fails. Idempotent processing, reliable event publishing, retries, and reconciliation help prevent missing or duplicated work.

## 8. Important Design Trade-Offs

### Trade-off 1: Asynchronous vs. synchronous thumbnail generation

**Option A: Synchronous processing**

The application generates the thumbnail before responding to the user.

Advantages:
- The image may be immediately ready for display.
- The workflow is relatively straightforward.

Disadvantages:
- Upload requests take longer.
- Slow image processing can reduce throughput.
- Spikes in uploads can overwhelm application servers.

**Option B: Asynchronous processing**

The application stores the original and schedules thumbnail generation in the background.

Advantages:
- Faster upload acknowledgement.
- Better separation of responsibilities.
- Background workers can scale independently.

Disadvantages:
- Thumbnails are not always immediately available.
- Queue failures and retries must be managed.
- Users may briefly see a placeholder.

**Recommendation:** Use asynchronous processing because it supports high upload volumes and independent scaling. Show a placeholder until the thumbnail is ready.

### Trade-off 2: Cache freshness vs. database load

**Option A: Minimal caching**

Most requests go directly to the database.

Advantages:
- Fresher database results.
- Simpler cache invalidation.

Disadvantages:
- Higher database load.
- Increased latency under heavy traffic.

**Option B: Aggressive caching**

Frequently accessed data is served from the cache or CDN.

Advantages:
- Lower database load.
- Faster responses.
- Reduced repeated origin requests.

Disadvantages:
- Cached data can become stale.
- Cache invalidation adds complexity.

**Recommendation:** Cache public image content aggressively where appropriate, use suitable expiration policies, and apply stricter cache controls to private content and frequently changing metadata.

### Trade-off 3: Read replicas vs. read-after-write consistency

**Option A: Read from the primary database**

Advantages:
- Simplifies read-after-write behaviour.
- Newly written metadata is more likely to be immediately visible.

Disadvantages:
- The primary handles both reads and writes.
- Heavy feed traffic may overload it.

**Option B: Use read replicas**

Advantages:
- Distributes read workloads.
- Can improve feed-query capacity.

Disadvantages:
- Replication lag may cause recently uploaded photos to appear missing temporarily.

**Recommendation:** Use read replicas for suitable feed queries, but direct critical read-after-write operations to the primary or implement a fallback when fresh data is required.

## 9. Scaling and Monitoring Strategy

SnapShare should scale according to observed demand rather than relying only on the initial estimates.

### Application scaling

- Scale application servers horizontally as request volume increases.
- Monitor CPU, memory, request latency, and error rates.
- Test performance at expected peak traffic and beyond.

### Queue and worker scaling

- Monitor queue depth and the age of the oldest job.
- Increase worker capacity when processing falls behind.
- Track retries, failed jobs, and dead-letter queue messages.

### Database scaling

- Monitor query latency, connection counts, CPU, storage, and replication lag.
- Optimise indexes and frequently used queries.
- Use read replicas for appropriate read-heavy workloads.

### Storage and CDN

- Track daily and monthly storage growth.
- Monitor CDN cache-hit ratio, bandwidth, and origin requests.
- Apply retention policies and lifecycle rules where appropriate.
- Protect private images using appropriate access controls and signed URLs.

### Reliability and security

- Use automated backups and test restoration procedures.
- Apply rate limits and upload-size restrictions.
- Validate uploaded files and use safe image-processing libraries.
- Monitor unauthorised access attempts and suspicious upload patterns.
- Test recovery procedures for object-storage, database, queue, and worker failures.

## 10. Conclusion

SnapShare's estimated workload is approximately one million photo uploads and 50 million feed page views per day, based on the stated assumptions. Original photos and thumbnails would add approximately 748.25 TB of storage per year before backups, replication, and other overheads.

A scalable solution combines object storage, a CDN, horizontally scaled application servers, asynchronous thumbnail workers, a reliable job queue, a primary database, read replicas, and caching.

The main design priorities are efficient image delivery, reliable background processing, appropriate data consistency, and continuous monitoring. Capacity estimates should be validated through load testing and adjusted using real production metrics as the application grows.