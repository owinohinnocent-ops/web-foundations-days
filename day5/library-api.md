
# Library Books REST API Design

## Overview

This REST API manages books in a library. It supports listing books,
retrieving a single book, creating, updating and deleting books, and
searching for books by author.

**Base URL:** `https://api.example.com/v1`

## Book Resource

A book has the following fields:

- `id`: Unique identifier for the book.
- `title`: Title of the book.
- `author`: Name of the author.
- `publishedYear`: Year the book was published.
- `isbn`: International Standard Book Number.

## API Endpoints

### 1. List All Books

- **Method:** GET
- **Path:** `/books`
- **Description:** Returns a list of all books in the library.
- **Success status:** `200 OK`
- **Example request body:** None required.

### 2. Get a Single Book

- **Method:** GET
- **Path:** `/books/{id}`
- **Description:** Returns details of a book with the specified ID.
- **Success status:** `200 OK`
- **Example request body:** None required.

### 3. Create a Book

- **Method:** POST
- **Path:** `/books`
- **Description:** Creates a new book in the library.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "publishedYear": 1958,
    "isbn": "9780385474542"
  }
  ```

- **Success status:** `201 Created`

### 4. Update a Book

- **Method:** PUT
- **Path:** `/books/{id}`
- **Description:** Replaces the details of the specified book.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "publishedYear": 1958,
    "isbn": "9780385474542"
  }
  ```

- **Success status:** `200 OK`

### 5. Delete a Book

- **Method:** DELETE
- **Path:** `/books/{id}`
- **Description:** Deletes the book with the specified ID.
- **Success status:** `204 No Content`
- **Example request body:** None required.

### 6. List Books by Author

- **Method:** GET
- **Path:** `/books?author=Chinua%20Achebe`
- **Description:** Returns books written by the specified author using a query parameter.
- **Success status:** `200 OK`
- **Example request body:** None required.

## Error Responses

### 400 Bad Request

- **Meaning:** The request contains invalid data or parameters.
- **Example:** A client tries to create a book without a required title or provides an invalid publication year.

### 404 Not Found

- **Meaning:** The requested resource does not exist.
- **Example:** A client requests `GET /books/999` when no book has ID `999`, or tries to update a nonexistent book.

## HTTP Method Summary

| Method | Purpose | Typical success status |
|---|---|---|
| GET | Retrieve books | 200 OK |
| POST | Create a book | 201 Created |
| PUT | Update a book | 200 OK |
| DELETE | Delete a book | 204 No Content |
