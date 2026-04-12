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



-----------------------
package com.clinic.service.impl;

import com.clinic.entity.Doctor;
import com.clinic.filter.DoctorFilter;
import com.clinic.repository.DoctorRepository;
import com.clinic.service.DoctorService;
import com.clinic.specification.DoctorSpecification;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class DoctorServiceImpl implements DoctorService {

    private final DoctorRepository doctorRepository;

    @Override
    public Doctor create(Doctor doctor) {
        if (doctor == null) {
            throw new IllegalArgumentException("Doctor must not be null");
        }
        if (doctor.getLicenseNumber() == null || doctor.getLicenseNumber().isBlank()) {
            throw new IllegalArgumentException("License number must not be blank");
        }
        if (doctorRepository.existsByLicenseNumber(doctor.getLicenseNumber())) {
            throw new IllegalArgumentException("Doctor with this license number already exists");
        }

        return doctorRepository.save(doctor);
    }

    @Override
    public Doctor update(Long id, Doctor doctor) {
        if (doctor == null) {
            throw new IllegalArgumentException("Doctor must not be null");
        }

        Doctor existing = getById(id);

        if (doctor.getLicenseNumber() != null
                && !doctor.getLicenseNumber().equals(existing.getLicenseNumber())
                && doctorRepository.existsByLicenseNumber(doctor.getLicenseNumber())) {
            throw new IllegalArgumentException("Doctor with this license number already exists");
        }

        existing.setFName(doctor.getFName());
        existing.setLName(doctor.getLName());
        existing.setEmail(doctor.getEmail());
        existing.setGender(doctor.getGender());
        existing.setPhoneNumber(doctor.getPhoneNumber());
        existing.setUsername(doctor.getUsername());
        existing.setPassword(doctor.getPassword());
        existing.setRole(doctor.getRole());
        existing.setSpecialization(doctor.getSpecialization());
        existing.setLicenseNumber(doctor.getLicenseNumber());
        existing.setStartingWorkingHour(doctor.getStartingWorkingHour());
        existing.setEndingWorkingHour(doctor.getEndingWorkingHour());

        return doctorRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public Doctor getById(Long id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Doctor not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Doctor> getAll(DoctorFilter filter, Pageable pageable) {
        if (filter == null) {
            filter = new DoctorFilter();
        }
        return doctorRepository.findAll(DoctorSpecification.withFilter(filter), pageable);
    }

    @Override
    public void delete(Long id) {
        Doctor doctor = getById(id);
        doctorRepository.delete(doctor);
    }
}


package com.clinic.service.impl;

import com.clinic.entity.Patient;
import com.clinic.filter.PatientFilter;
import com.clinic.repository.PatientRepository;
import com.clinic.service.PatientService;
import com.clinic.specification.PatientSpecification;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PatientServiceImpl implements PatientService {

    private final PatientRepository patientRepository;

    @Override
    public Patient create(Patient patient) {
        if (patient == null) {
            throw new IllegalArgumentException("Patient must not be null");
        }
        if (patient.getEmail() != null && patientRepository.existsByEmail(patient.getEmail())) {
            throw new IllegalArgumentException("Patient with this email already exists");
        }

        return patientRepository.save(patient);
    }

    @Override
    public Patient update(Long id, Patient patient) {
        if (patient == null) {
            throw new IllegalArgumentException("Patient must not be null");
        }

        Patient existing = getById(id);

        if (patient.getEmail() != null
                && !patient.getEmail().equalsIgnoreCase(existing.getEmail())
                && patientRepository.existsByEmail(patient.getEmail())) {
            throw new IllegalArgumentException("Patient with this email already exists");
        }

        existing.setFName(patient.getFName());
        existing.setLName(patient.getLName());
        existing.setEmail(patient.getEmail());
        existing.setGender(patient.getGender());
        existing.setPhoneNumber(patient.getPhoneNumber());
        existing.setBloodType(patient.getBloodType());
        existing.setAllergies(patient.getAllergies());
        existing.setDateOfBirth(patient.getDateOfBirth());

        return patientRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public Patient getById(Long id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Patient not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Patient> getAll(PatientFilter filter, Pageable pageable) {
        if (filter == null) {
            filter = new PatientFilter();
        }
        return patientRepository.findAll(PatientSpecification.withFilter(filter), pageable);
    }

    @Override
    public void delete(Long id) {
        Patient patient = getById(id);
        patientRepository.delete(patient);
    }
}

package com.clinic.service.impl;

import com.clinic.entity.Receptionist;
import com.clinic.repository.ReceptionistRepository;
import com.clinic.service.ReceptionistService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ReceptionistServiceImpl implements ReceptionistService {

    private final ReceptionistRepository receptionistRepository;

    @Override
    public Receptionist create(Receptionist receptionist) {
        if (receptionist == null) {
            throw new IllegalArgumentException("Receptionist must not be null");
        }
        if (receptionist.getUsername() == null || receptionist.getUsername().isBlank()) {
            throw new IllegalArgumentException("Username must not be blank");
        }
        if (receptionistRepository.existsByUsername(receptionist.getUsername())) {
            throw new IllegalArgumentException("Receptionist with this username already exists");
        }

        return receptionistRepository.save(receptionist);
    }

    @Override
    public Receptionist update(Long id, Receptionist receptionist) {
        if (receptionist == null) {
            throw new IllegalArgumentException("Receptionist must not be null");
        }

        Receptionist existing = getById(id);

        if (receptionist.getUsername() != null
                && !receptionist.getUsername().equals(existing.getUsername())
                && receptionistRepository.existsByUsername(receptionist.getUsername())) {
            throw new IllegalArgumentException("Receptionist with this username already exists");
        }

        existing.setFName(receptionist.getFName());
        existing.setLName(receptionist.getLName());
        existing.setEmail(receptionist.getEmail());
        existing.setGender(receptionist.getGender());
        existing.setPhoneNumber(receptionist.getPhoneNumber());
        existing.setUsername(receptionist.getUsername());
        existing.setPassword(receptionist.getPassword());
        existing.setRole(receptionist.getRole());
        existing.setDeskNumber(receptionist.getDeskNumber());

        return receptionistRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public Receptionist getById(Long id) {
        return receptionistRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Receptionist not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Receptionist> getAll(Pageable pageable) {
        return receptionistRepository.findAll(pageable);
    }

    @Override
    public void delete(Long id) {
        Receptionist receptionist = getById(id);
        receptionistRepository.delete(receptionist);
    }
}

package com.clinic.service.impl;

import com.clinic.entity.Drug;
import com.clinic.filter.DrugFilter;
import com.clinic.repository.DrugRepository;
import com.clinic.service.DrugService;
import com.clinic.specification.DrugSpecification;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
@Transactional
public class DrugServiceImpl implements DrugService {

    private final DrugRepository drugRepository;

    @Override
    public Drug create(Drug drug) {
        if (drug == null) {
            throw new IllegalArgumentException("Drug must not be null");
        }
        if (drug.getName() == null || drug.getName().isBlank()) {
            throw new IllegalArgumentException("Drug name must not be blank");
        }
        if (drugRepository.existsByNameIgnoreCase(drug.getName())) {
            throw new IllegalArgumentException("Drug with this name already exists");
        }

        return drugRepository.save(drug);
    }

    @Override
    public Drug update(Long id, Drug drug) {
        if (drug == null) {
            throw new IllegalArgumentException("Drug must not be null");
        }

        Drug existing = getById(id);

        if (drug.getName() != null
                && !drug.getName().equalsIgnoreCase(existing.getName())
                && drugRepository.existsByNameIgnoreCase(drug.getName())) {
            throw new IllegalArgumentException("Drug with this name already exists");
        }

        existing.setName(drug.getName());
        existing.setDescription(drug.getDescription());
        existing.setPrice(drug.getPrice());
        existing.setCategory(drug.getCategory());
        existing.setQuantity(drug.getQuantity());

        return drugRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public Drug getById(Long id) {
        return drugRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Drug not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Drug> getAll(DrugFilter filter, Pageable pageable) {
        if (filter == null) {
            filter = new DrugFilter();
        }
        return drugRepository.findAll(DrugSpecification.withFilter(filter), pageable);
    }

    @Override
    public void delete(Long id) {
        Drug drug = getById(id);
        drugRepository.delete(drug);
    }

    @Override
    public Drug updatePrice(Long id, BigDecimal newPrice) {
        if (newPrice == null || newPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price must be non-negative");
        }

        Drug drug = getById(id);
        drug.setPrice(newPrice);
        return drugRepository.save(drug);
    }

    @Override
    public Drug updateQuantity(Long id, Integer quantity) {
        if (quantity == null || quantity < 0) {
            throw new IllegalArgumentException("Quantity must be non-negative");
        }

        Drug drug = getById(id);
        drug.setQuantity(quantity);
        return drugRepository.save(drug);
    }
}

package com.clinic.service.impl;

import com.clinic.entity.MedicalRecord;
import com.clinic.entity.Patient;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.service.MedicalRecordService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MedicalRecordServiceImpl implements MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PatientRepository patientRepository;

    @Override
    public MedicalRecord create(MedicalRecord medicalRecord) {
        validateMedicalRecord(medicalRecord);

        Long patientId = medicalRecord.getPatient().getId();
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new EntityNotFoundException("Patient not found with id: " + patientId));

        medicalRecord.setPatient(patient);
        return medicalRecordRepository.save(medicalRecord);
    }

    @Override
    public MedicalRecord update(Long id, MedicalRecord medicalRecord) {
        validateMedicalRecord(medicalRecord);

        MedicalRecord existing = getById(id);

        Long patientId = medicalRecord.getPatient().getId();
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new EntityNotFoundException("Patient not found with id: " + patientId));

        existing.setDiagnosis(medicalRecord.getDiagnosis());
        existing.setNote(medicalRecord.getNote());
        existing.setRecordDate(medicalRecord.getRecordDate());
        existing.setPatient(patient);

        return medicalRecordRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public MedicalRecord getById(Long id) {
        return medicalRecordRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Medical record not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MedicalRecord> getAll(Pageable pageable) {
        return medicalRecordRepository.findAll(pageable);
    }

    @Override
    public void delete(Long id) {
        MedicalRecord medicalRecord = getById(id);
        medicalRecordRepository.delete(medicalRecord);
    }

    private void validateMedicalRecord(MedicalRecord medicalRecord) {
        if (medicalRecord == null) {
            throw new IllegalArgumentException("Medical record must not be null");
        }
        if (medicalRecord.getPatient() == null || medicalRecord.getPatient().getId() == null) {
            throw new IllegalArgumentException("Patient must not be null");
        }
        if (medicalRecord.getRecordDate() == null) {
            throw new IllegalArgumentException("Record date must not be null");
        }
    }
}


package com.clinic.service.impl;

import com.clinic.entity.Appointment;
import com.clinic.entity.Prescription;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.PrescriptionRepository;
import com.clinic.service.PrescriptionService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PrescriptionServiceImpl implements PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final AppointmentRepository appointmentRepository;

    @Override
    public Prescription create(Prescription prescription) {
        validatePrescription(prescription);

        Long appointmentId = prescription.getAppointment().getId();
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new EntityNotFoundException("Appointment not found with id: " + appointmentId));

        prescription.setAppointment(appointment);
        return prescriptionRepository.save(prescription);
    }

    @Override
    public Prescription update(Long id, Prescription prescription) {
        validatePrescription(prescription);

        Prescription existing = getById(id);

        Long appointmentId = prescription.getAppointment().getId();
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new EntityNotFoundException("Appointment not found with id: " + appointmentId));

        existing.setAppointment(appointment);
        existing.setDrugIntake(prescription.getDrugIntake()); // rename if your field is different

        return prescriptionRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public Prescription getById(Long id) {
        return prescriptionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Prescription not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Prescription> getAll(Pageable pageable) {
        return prescriptionRepository.findAll(pageable);
    }

    @Override
    public void delete(Long id) {
        Prescription prescription = getById(id);
        prescriptionRepository.delete(prescription);
    }

    private void validatePrescription(Prescription prescription) {
        if (prescription == null) {
            throw new IllegalArgumentException("Prescription must not be null");
        }
        if (prescription.getAppointment() == null || prescription.getAppointment().getId() == null) {
            throw new IllegalArgumentException("Appointment must not be null");
        }
    }
}

package com.clinic.service.impl;

import com.clinic.entity.Appointment;
import com.clinic.entity.Invoice;
import com.clinic.enums.PaymentStatus;
import com.clinic.filter.InvoiceFilter;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.InvoiceRepository;
import com.clinic.service.InvoiceService;
import com.clinic.specification.InvoiceSpecification;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
@Transactional
public class InvoiceServiceImpl implements InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final AppointmentRepository appointmentRepository;

    @Override
    public Invoice create(Invoice invoice) {
        validateInvoice(invoice);

        Long appointmentId = invoice.getAppointment().getId();
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new EntityNotFoundException("Appointment not found with id: " + appointmentId));

        invoice.setAppointment(appointment);

        if (invoice.getPaymentStatus() == null) {
            invoice.setPaymentStatus(PaymentStatus.PENDING);
        }

        if (invoice.getTotalAmount() == null) {
            invoice.setTotalAmount(calculateTotal(invoice));
        }

        return invoiceRepository.save(invoice);
    }

    @Override
    public Invoice update(Long id, Invoice invoice) {
        validateInvoice(invoice);

        Invoice existing = getById(id);

        Long appointmentId = invoice.getAppointment().getId();
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new EntityNotFoundException("Appointment not found with id: " + appointmentId));

        existing.setAppointment(appointment);
        existing.setDoctorFee(invoice.getDoctorFee());
        existing.setAppointmentCost(invoice.getAppointmentCost());
        existing.setPaymentMethod(invoice.getPaymentMethod());
        existing.setPaymentStatus(invoice.getPaymentStatus() != null ? invoice.getPaymentStatus() : existing.getPaymentStatus());
        existing.setTotalAmount(calculateTotal(invoice));

        return invoiceRepository.save(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public Invoice getById(Long id) {
        return invoiceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Invoice not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Invoice> getAll(InvoiceFilter filter, Pageable pageable) {
        if (filter == null) {
            filter = new InvoiceFilter();
        }
        return invoiceRepository.findAll(InvoiceSpecification.withFilter(filter), pageable);
    }

    @Override
    public void delete(Long id) {
        Invoice invoice = getById(id);
        invoiceRepository.delete(invoice);
    }

    @Override
    public Invoice markAsPaid(Long id) {
        Invoice invoice = getById(id);
        invoice.setPaymentStatus(PaymentStatus.PAID);
        return invoiceRepository.save(invoice);
    }

    private void validateInvoice(Invoice invoice) {
        if (invoice == null) {
            throw new IllegalArgumentException("Invoice must not be null");
        }
        if (invoice.getAppointment() == null || invoice.getAppointment().getId() == null) {
            throw new IllegalArgumentException("Appointment must not be null");
        }
        if (invoice.getDoctorFee() != null && invoice.getDoctorFee().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Doctor fee must be non-negative");
        }
        if (invoice.getAppointmentCost() != null && invoice.getAppointmentCost().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Appointment cost must be non-negative");
        }
    }

    private BigDecimal calculateTotal(Invoice invoice) {
        BigDecimal doctorFee = invoice.getDoctorFee() == null ? BigDecimal.ZERO : invoice.getDoctorFee();
        BigDecimal appointmentCost = invoice.getAppointmentCost() == null ? BigDecimal.ZERO : invoice.getAppointmentCost();
        return doctorFee.add(appointmentCost);
    }
}

