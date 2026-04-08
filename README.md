# 🧠 TokenSphere Backend (Express + PostgreSQL)

This repository contains the **backend API** for TokenSphere - a small social platform where users can join communities, post updates, create polls and events, and transfer in‑app credits. The service is built with **Node.js**, **Express**, and **PostgreSQL** and exposes a JSON API for clients such as React apps or mobile clients to consume.

## 🏗️ Tech Stack

- **Node.js** with **Express** for the HTTP server
- **PostgreSQL** using the pg library for database access
- **dotenv**, **cors** and **morgan** for environment configuration, CORS handling and request logging
- Simple role‑based middleware (adminAuth.js) to guard administrative routes

## 🚀 Getting Started

- **Install dependencies**

- npm install

- **Create and initialise a PostgreSQL database** (e.g. tokensphere). A sample schema is provided in schema.sql; run it with psql or your favourite tool:

- createdb tokensphere  
   psql -d tokensphere -f schema.sql

- **Create a .env file** with your database connection string. For example:

- DATABASE_URL=postgres://postgres:password@localhost:5432/tokensphere  
   PORT=5000

- **Start the server**

- node server.js
- By default the API will run on <http://localhost:5000>.

## 🗂️ Project Structure

The server code is organised by route and by responsibility. Below is an overview of the key files:

project/  
├── routes/  
│ ├── auth.js # sign up & login  
│ ├── users.js # user listing and profile update  
│ ├── wallet.js # wallet and transactions  
│ ├── posts.js # posts, polls & events  
│ ├── communities.js # communities CRUD & join/leave  
│ └── admin/  
│ ├── overview.js # dashboard statistics (admin only)  
│ ├── community.js # admin community management  
│ └── users.js # admin user management  
├── middleware/  
│ └── adminAuth.js # simple admin role guard  
├── db.js # exports a configured pg client  
├── server.js # API entry point, mounts all routes  
└── schema.sql # database schema (tables & triggers)

Each route module exports an express.Router() instance which is mounted in server.js under a specific prefix. For example, posts.js is mounted at /api/posts, so its GET / handler corresponds to GET /api/posts.

## 📡 API Endpoints

### 🔐 Auth Routes

Base URL: /api/auth

| Method | Endpoint | Description                   |
| ------ | -------- | ----------------------------- |
| POST   | /signup  | Register a new user           |
| POST   | /login   | Authenticate an existing user |

#### 🔸 POST /api/auth/signup

Registers a new account. On success it also creates a profile and a wallet with an initial balance of 100 credits.

Request body:

{  
"email": "<user@example.com>",  
"username": "user123",  
"display_name": "User 123",  
"password": "secret"  
}

Response (201):

{  
"user": {  
"id": 1,  
"email": "<user@example.com>",  
"username": "user123",  
"role": "user",  
"created_at": "2026-01-18T09:00:00.000Z",  
"display_name": "User 123",  
"avatar_url": null,  
"bio": null  
}  
}

#### 🔸 POST /api/auth/login

Logs in an existing user. Returns user details on success or a 401 error for invalid credentials.

Request body:

{  
"email": "<user@example.com>",  
"password": "secret"  
}

Response (200):

{  
"user": {  
"id": 1,  
"email": "<user@example.com>",  
"username": "user123",  
"role": "user",  
"display_name": "User 123",  
"avatar_url": null,  
"bio": null  
}  
}

### 👤 User Routes

Base URL: /api/users

| Method | Endpoint            | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| GET    | /                   | List users (optionally excluding one user) |
| GET    | /username/:username | Fetch a single user by username            |
| PUT    | /:id/profile        | Update a user's profile                    |

#### 🔸 GET /api/users

Lists all users, returning their id, username, display_name and avatar_url. You can exclude a particular user by ID via the exclude_id query parameter (useful for "discover" lists).

Example: GET /api/users?exclude_id=42

Response (200):

{  
"users": \[  
{ "id": 1, "username": "alice", "display_name": "Alice", "avatar_url": null },  
{ "id": 2, "username": "bob", "display_name": "Bob", "avatar_url": null }  
\]  
}

#### 🔸 GET /api/users/username/:username

Returns detailed information about a single user, including their profile, wallet balance and post count. If the user does not exist, a 404 is returned.

Response fields:

- id, email, username, role, created_at
- Profile: display_name, avatar_url, bio
- Wallet: balance (may be null if no wallet)
- posts_count: number of posts authored by the user

#### 🔸 PUT /api/users/:id/profile

Updates the display name, bio and avatar for the user's profile. A simple ownership check is performed via the x-user-id header; the header must match the :id parameter.

Headers:

x-user-id: 5

Request body:

{  
"display_name": "New Name",  
"bio": "Updated bio",  
"avatar_url": "<https://example.com/avatar.png>"  
}

Response (200):

{  
"user": {  
"id": 5,  
"email": "<user@example.com>",  
"username": "user123",  
"display_name": "New Name",  
"avatar_url": "<https://example.com/avatar.png>",  
"bio": "Updated bio"  
}  
}

### 💰 Wallet Routes

Base URL: /api/wallet

| Method | Endpoint              | Description                        |
| ------ | --------------------- | ---------------------------------- |
| GET    | /:userId              | Get a user's wallet                |
| GET    | /:userId/transactions | Get recent transactions for a user |
| POST   | /transfer             | Transfer credits between users     |

#### 🔸 GET /api/wallet/:userId

Returns the wallet for the specified user. If the wallet does not exist a 404 is returned.

Response (200):

{  
"wallet": {  
"id": 3,  
"user_id": 1,  
"balance": 150,  
"created_at": "2026-01-17T12:00:00.000Z"  
}  
}

#### 🔸 GET /api/wallet/:userId/transactions

Returns all transactions involving the user. Each transaction includes nested from_user and to_user objects populated from the users and profiles tables.

Example response:

{  
"transactions": \[  
{  
"id": 10,  
"from_user_id": 1,  
"to_user_id": 2,  
"amount": 25,  
"description": "Tip for great answer",  
"created_at": "2026-01-18T10:30:00.000Z",  
"from_user": { "id": 1, "username": "alice", "display_name": "Alice", "avatar_url": null },  
"to_user": { "id": 2, "username": "bob", "display_name": "Bob", "avatar_url": null }  
}  
\]  
}

#### 🔸 POST /api/wallet/transfer

Transfers credits between two users. The server performs balance checks, ensures both wallets exist and wraps the operation in a transaction to avoid race conditions.

Request body:

{  
"from_user_id": 1,  
"to_user_id": 2,  
"amount": 50,  
"description": "Thanks!"  
}

On success (201) the response returns the inserted transaction:

{  
"transaction": {  
"id": 11,  
"from_user_id": 1,  
"to_user_id": 2,  
"amount": 50,  
"description": "Thanks!",  
"created_at": "2026-01-18T12:15:00.000Z"  
}  
}

### 📝 Post Routes (Posts, Polls & Events)

Base URL: /api/posts

| Method | Endpoint    | Description                              |
| ------ | ----------- | ---------------------------------------- |
| GET    | /           | Fetch posts feed (with optional filters) |
| POST   | /           | Create a post, poll or event             |
| POST   | /:id/like   | Toggle like on a post                    |
| POST   | /:id/vote   | Vote on a poll                           |
| POST   | /:id/attend | Toggle attendance on an event            |
| DELETE | /:id        | Delete a post (author only)              |

#### 🔸 GET /api/posts

Fetches a feed of posts. The response includes public posts and community posts depending on the community_id query parameter:

- community_id omitted or null: return public posts only (where community_id is null).
- community_id=&lt;id&gt;: return posts from that community.
- author_id=&lt;id&gt;: return posts written by that author.
- user_id=&lt;id&gt;: compute personalised fields (liked_by_me, user_vote, is_attending).
- limit: limit the number of results (default 50, maximum 200).

Each item in the posts array has at least the following shape:

{  
"id": 5,  
"type": "post" | "poll" | "event",  
"content": "Text content (for posts)",  
"created_at": "2026-01-18T12:34:00.000Z",  
"likes_count": 3,  
"comments_count": 0,  
"community_id": null,  
"profiles": {  
"id": 1,  
"username": "alice",  
"display_name": "Alice",  
"avatar_url": null  
},  
"liked_by_me": true  
}

Depending on type, additional fields are included:

- **Polls**: question, ends_at, options (array of { id, text, votes }), total_votes, and user_vote (option ID or null).
- **Events**: title, description, start_date, end_date, location, attendees_count, and is_attending (boolean).

#### 🔸 POST /api/posts

Creates a new post. The type field determines how the request is processed:

- **Post** (type = "post" - default): requires content. The community_id may be null for public posts or set to a community ID.
- **Poll** (type = "poll"): requires question and an array of at least two poll_options (or options). Optional duration_hours (default 24) sets when the poll closes.
- **Event** (type = "event"): requires title, location, start_date (ISO string). Optional description, end_date and community_id.

Example request - creating a poll:

{  
"author_id": 1,  
"type": "poll",  
"question": "What's your favourite programming language?",  
"poll_options": \["JavaScript", "Python", "Go"\],  
"duration_hours": 48,  
"community_id": null  
}

The response includes the newly created post (with empty votes for polls and zero attendees for events).

#### 🔸 POST /api/posts/:id/like

Toggles a like on a post. Send the user_id in the request body. The response indicates whether the post is now liked by the user and the updated likes_count.

Request body:

{ "user_id": 1 }

Response (200):

{ "liked_by_me": true, "likes_count": 4 }

#### 🔸 POST /api/posts/:id/vote

Casts a vote on a poll option. The poll must still be open. The response returns the updated vote counts and the total number of votes.

Request body:

{ "user_id": 1, "option_id": 7 }

#### 🔸 POST /api/posts/:id/attend

Toggles attendance on an event. Returns the current attendee count and whether the user is attending.

Request body:

{ "user_id": 1 }

Response:

{ "attendees_count": 12, "is_attending": true }

#### 🔸 DELETE /api/posts/:id

Deletes a post. Only the author (identified via the x-user-id header) can delete their own posts. Returns the ID of the deleted post.

### 🌐 Community Routes

Base URL: /api/communities

| Method | Endpoint   | Description                                          |
| ------ | ---------- | ---------------------------------------------------- |
| GET    | /          | List communities with membership info                |
| GET    | /:id       | Fetch a single community by ID                       |
| POST   | /          | Create a new community                               |
| POST   | /:id/join  | Join a community                                     |
| POST   | /:id/leave | Leave a community                                    |
| GET    | /:id/feed  | Fetch community‑specific feed (posts, polls, events) |

#### 🔸 GET /api/communities?user_id=&lt;uid&gt;

Returns a list of active communities. Each entry includes:

- id, name, description, creator_id, min_credits_required, status, created_at
- members_count: number of members in the community
- is_member: true if the requesting user (user_id query param) is a member

#### 🔸 GET /api/communities/:id?user_id=&lt;uid&gt;

Returns one community with the same fields as above. If the community does not exist a 404 is returned.

#### 🔸 POST /api/communities

Creates a community. The creator automatically becomes an owner member. Community names must be unique.

Request body:

{  
"creator_id": 1,  
"name": "Chess Lovers",  
"description": "A place to discuss chess openings",  
"min_credits_required": 10  
}

Response:

{  
"id": 3,  
"name": "Chess Lovers",  
"description": "A place to discuss chess openings",  
"creator_id": 1,  
"min_credits_required": 10,  
"status": "active",  
"created_at": "2026-01-18T11:00:00.000Z",  
"members_count": 1,  
"is_member": true  
}

#### 🔸 POST /api/communities/:id/join

Join an active community. If the community enforces a minimum credit balance, the user's wallet must contain at least that amount. Send the user_id in the request body.

Response (200):

{ "message": "Joined community" }

#### 🔸 POST /api/communities/:id/leave

Leave a community. Owners cannot leave their own communities. Send the user_id in the request body. If the user is not a member the request succeeds with a friendly message.

#### 🔸 GET /api/communities/:id/feed?user_id=&lt;uid&gt;

Returns a feed of **posts**, **polls** and **events** inside a community. The requesting user must be a member; otherwise a 403 is returned. The response has three arrays - posts, polls and events - each shaped similarly to the objects returned by /api/posts but without the community_id field.

### ⚙️ Admin Routes

Administrative routes are protected by the adminAuth middleware. Clients must send x-role: admin in the headers.

#### 📊 GET /api/admin/overview

Returns high‑level statistics and recent activity. Accepts optional query parameters users_limit and communities_limit to control the number of recent users and communities returned.

Response example:

{  
"stats": {  
"totalUsers": 100,  
"totalPosts": 250,  
"totalCommunities": 8,  
"totalTransactions": 40  
},  
"recentUsers": \[  
{ "id": 7, "username": "newbie", "display_name": "Newbie", "avatar_url": null, "created_at": "2026-01-17T23:00:00.000Z" },  
...  
\],  
"recentCommunities": \[  
{ "id": 5, "name": "React Devs", "created_at": "2026-01-10T18:00:00.000Z", "status": "active", "members_count": 12 },  
...  
\]  
}

#### 🛠️ Admin Community Routes (Base URL /api/admin/community)

| Method | Endpoint    | Description                                          |
| ------ | ----------- | ---------------------------------------------------- |
| GET    | /           | List communities with metadata (admin only)          |
| PATCH  | /:id/status | Update a community's status (active/locked/disabled) |

**Example** - lock a community:

PATCH /api/admin/community/3/status  
Headers: { "x-role": "admin" }  
Body: { "status": "locked" }

Response:

{  
"community": {  
"id": 3,  
"name": "Chess Lovers",  
"status": "locked",  
"created_at": "2026-01-18T11:00:00.000Z"  
}  
}

#### 👥 Admin Users Routes (Base URL /api/admin/users)

The admin/users namespace allows administrators to inspect and delete user accounts. Every request must include the x-role: admin header. Only non‑admin accounts can be deleted.

| Method | Endpoint | Description                                                                                                                                                                                               |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /        | List users with profile and role information. Supports limit and offset query parameters for pagination. Returns an array of { id, username, email, role, created_at, display_name, avatar_url } objects. |
| DELETE | /:id     | Permanently delete a user by ID. Transactions involving the user are removed first. Admin accounts cannot be deleted. Responds with a success message on completion.                                      |

**Example - List users**:

GET /api/admin/users?limit=25&offset=0  
Headers: { "x-role": "admin" }

**Example - Delete a user**:

DELETE /api/admin/users/7  
Headers: { "x-role": "admin" }

Response:

{ "message": "User deleted successfully" }

This README documents the available endpoints for the TokenSphere backend and should provide everything you need to get the API up and running locally. Feel free to expand it as you add more functionality!




package com.clinic.specification;

import com.clinic.entity.Patient;
import com.clinic.filter.PatientFilter;
import org.springframework.data.jpa.domain.Specification;

public class PatientSpecification {

    public static Specification<Patient> withFilter(PatientFilter filter) {
        return Specification.where(firstNameContains(filter.getFirstName()))
                .and(lastNameContains(filter.getLastName()))
                .and(emailContains(filter.getEmail()))
                .and(phoneContains(filter.getPhoneNumber()))
                .and(bloodTypeEquals(filter.getBloodType()))
                .and(dateOfBirthGreaterThanOrEqual(filter.getDateOfBirthFrom()))
                .and(dateOfBirthLessThanOrEqual(filter.getDateOfBirthTo()));
    }

    private static Specification<Patient> firstNameContains(String firstName) {
        return (root, query, cb) ->
                firstName == null || firstName.isBlank() ? null :
                        cb.like(cb.lower(root.get("fName")), "%" + firstName.toLowerCase() + "%");
    }

    private static Specification<Patient> lastNameContains(String lastName) {
        return (root, query, cb) ->
                lastName == null || lastName.isBlank() ? null :
                        cb.like(cb.lower(root.get("lName")), "%" + lastName.toLowerCase() + "%");
    }

    private static Specification<Patient> emailContains(String email) {
        return (root, query, cb) ->
                email == null || email.isBlank() ? null :
                        cb.like(cb.lower(root.get("email")), "%" + email.toLowerCase() + "%");
    }

    private static Specification<Patient> phoneContains(String phone) {
        return (root, query, cb) ->
                phone == null || phone.isBlank() ? null :
                        cb.like(cb.lower(root.get("phoneNumber")), "%" + phone.toLowerCase() + "%");
    }

    private static Specification<Patient> bloodTypeEquals(String bloodType) {
        return (root, query, cb) ->
                bloodType == null || bloodType.isBlank() ? null :
                        cb.equal(cb.lower(root.get("bloodType")), bloodType.toLowerCase());
    }

    private static Specification<Patient> dateOfBirthGreaterThanOrEqual(java.time.LocalDate from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("dateOfBirth"), from);
    }

    private static Specification<Patient> dateOfBirthLessThanOrEqual(java.time.LocalDate to) {
        return (root, query, cb) -> to == null ? null : cb.lessThanOrEqualTo(root.get("dateOfBirth"), to);
    }
}


package com.clinic.specification;

import com.clinic.entity.Appointment;
import com.clinic.filter.AppointmentFilter;
import org.springframework.data.jpa.domain.Specification;

public class AppointmentSpecification {

    public static Specification<Appointment> withFilter(AppointmentFilter filter) {
        return Specification.where(hasPatientId(filter.getPatientId()))
                .and(hasDoctorId(filter.getDoctorId()))
                .and(hasStatus(filter.getStatus()))
                .and(dateGreaterThanOrEqual(filter.getDateFrom()))
                .and(dateLessThanOrEqual(filter.getDateTo()))
                .and(startGreaterThanOrEqual(filter.getStartFrom()))
                .and(startLessThanOrEqual(filter.getStartTo()));
    }

    private static Specification<Appointment> hasPatientId(Long patientId) {
        return (root, query, cb) -> patientId == null ? null : cb.equal(root.get("patient").get("id"), patientId);
    }

    private static Specification<Appointment> hasDoctorId(Long doctorId) {
        return (root, query, cb) -> doctorId == null ? null : cb.equal(root.get("doctor").get("id"), doctorId);
    }

    private static Specification<Appointment> hasStatus(com.clinic.enums.AppointmentStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    private static Specification<Appointment> dateGreaterThanOrEqual(java.time.LocalDate from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("appointmentDate"), from);
    }

    private static Specification<Appointment> dateLessThanOrEqual(java.time.LocalDate to) {
        return (root, query, cb) -> to == null ? null : cb.lessThanOrEqualTo(root.get("appointmentDate"), to);
    }

    private static Specification<Appointment> startGreaterThanOrEqual(java.time.LocalTime from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("appointmentStart"), from);
    }

    private static Specification<Appointment> startLessThanOrEqual(java.time.LocalTime to) {
        return (root, query, cb) -> to == null ? null : cb.lessThanOrEqualTo(root.get("appointmentStart"), to);
    }
}


package com.clinic.specification;

import com.clinic.entity.Drug;
import com.clinic.filter.DrugFilter;
import org.springframework.data.jpa.domain.Specification;

public class DrugSpecification {

    public static Specification<Drug> withFilter(DrugFilter filter) {
        return Specification.where(nameContains(filter.getName()))
                .and(categoryEquals(filter.getCategory()))
                .and(priceGreaterThanOrEqual(filter.getMinPrice()))
                .and(priceLessThanOrEqual(filter.getMaxPrice()))
                .and(quantityGreaterThanOrEqual(filter.getMinQuantity()))
                .and(quantityLessThanOrEqual(filter.getMaxQuantity()));
    }

    private static Specification<Drug> nameContains(String name) {
        return (root, query, cb) ->
                name == null || name.isBlank() ? null :
                        cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    private static Specification<Drug> categoryEquals(String category) {
        return (root, query, cb) ->
                category == null || category.isBlank() ? null :
                        cb.equal(cb.lower(root.get("category")), category.toLowerCase());
    }

    private static Specification<Drug> priceGreaterThanOrEqual(java.math.BigDecimal minPrice) {
        return (root, query, cb) -> minPrice == null ? null : cb.greaterThanOrEqualTo(root.get("price"), minPrice);
    }

    private static Specification<Drug> priceLessThanOrEqual(java.math.BigDecimal maxPrice) {
        return (root, query, cb) -> maxPrice == null ? null : cb.lessThanOrEqualTo(root.get("price"), maxPrice);
    }

    private static Specification<Drug> quantityGreaterThanOrEqual(Integer minQuantity) {
        return (root, query, cb) -> minQuantity == null ? null : cb.greaterThanOrEqualTo(root.get("quantity"), minQuantity);
    }

    private static Specification<Drug> quantityLessThanOrEqual(Integer maxQuantity) {
        return (root, query, cb) -> maxQuantity == null ? null : cb.lessThanOrEqualTo(root.get("quantity"), maxQuantity);
    }
}

package com.clinic.specification;

import com.clinic.entity.Invoice;
import com.clinic.filter.InvoiceFilter;
import org.springframework.data.jpa.domain.Specification;

public class InvoiceSpecification {

    public static Specification<Invoice> withFilter(InvoiceFilter filter) {
        return Specification.where(hasPatientId(filter.getPatientId()))
                .and(hasAppointmentId(filter.getAppointmentId()))
                .and(hasPaymentStatus(filter.getPaymentStatus()))
                .and(hasPaymentMethod(filter.getPaymentMethod()))
                .and(totalGreaterThanOrEqual(filter.getMinTotal()))
                .and(totalLessThanOrEqual(filter.getMaxTotal()))
                .and(issueDateGreaterThanOrEqual(filter.getIssueDateFrom()))
                .and(issueDateLessThanOrEqual(filter.getIssueDateTo()));
    }

    private static Specification<Invoice> hasPatientId(Long patientId) {
        return (root, query, cb) -> patientId == null ? null : cb.equal(root.get("appointment").get("patient").get("id"), patientId);
    }

    private static Specification<Invoice> hasAppointmentId(Long appointmentId) {
        return (root, query, cb) -> appointmentId == null ? null : cb.equal(root.get("appointment").get("id"), appointmentId);
    }

    private static Specification<Invoice> hasPaymentStatus(com.clinic.enums.PaymentStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("paymentStatus"), status);
    }

    private static Specification<Invoice> hasPaymentMethod(com.clinic.enums.PaymentMethod method) {
        return (root, query, cb) -> method == null ? null : cb.equal(root.get("paymentMethod"), method);
    }

    private static Specification<Invoice> totalGreaterThanOrEqual(java.math.BigDecimal minTotal) {
        return (root, query, cb) -> minTotal == null ? null : cb.greaterThanOrEqualTo(root.get("totalAmount"), minTotal);
    }

    private static Specification<Invoice> totalLessThanOrEqual(java.math.BigDecimal maxTotal) {
        return (root, query, cb) -> maxTotal == null ? null : cb.lessThanOrEqualTo(root.get("totalAmount"), maxTotal);
    }

    private static Specification<Invoice> issueDateGreaterThanOrEqual(java.time.LocalDate from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("appointmentDate"), from);
    }

    private static Specification<Invoice> issueDateLessThanOrEqual(java.time.LocalDate to) {
        return (root, query, cb) -> to == null ? null : cb.lessThanOrEqualTo(root.get("appointmentDate"), to);
    }
}
