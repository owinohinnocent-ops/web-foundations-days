# School Database Design

## 1. Tables

- **Students:** Stores each student's unique ID, name, and email. The email is required and must be unique to prevent two students from using the same email address.
- **Courses:** Stores each course's unique ID, name, and course code. The course code is required and unique.
- **Enrolments:** Connects students to courses and stores the grade earned in each course. Foreign keys link each enrolment to an existing student and course. A unique constraint on `student_id` and `course_id` prevents a student from enrolling in the same course more than once.

## 2. Relationships

- **Students to enrolments — one-to-many:** One student can have several enrolment records, but each enrolment belongs to one student.
- **Courses to enrolments — one-to-many:** One course can have many enrolment records, but each enrolment refers to one course.
- **Students to courses — many-to-many:** A student can take several courses, and each course can have several students. The `enrolments` table resolves this many-to-many relationship and stores additional information, such as grades.

## 3. Index

I would add an index on `enrolments(course_id)` to help the database find enrolments for a particular course more efficiently. This is useful when listing students taking a course or counting enrolments per course.

```sql
CREATE INDEX idx_enrolments_course_id
ON enrolments(course_id);
```

## 4. SQL vs NoSQL

I would choose a relational SQL database such as SQLite for this school system because students, courses, and enrolments have clear relationships and structured data. Primary keys, foreign keys, unique constraints, and transactions help maintain data accuracy and integrity. SQL joins also make it easy to retrieve students' courses and calculate enrolment totals. NoSQL databases are useful for flexible or document-based data, but a relational database is a suitable choice for this system because its data is structured and requires clear relationships.
