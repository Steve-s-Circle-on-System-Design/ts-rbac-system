# `Enterprise Role-Based Access Control (RBAC) & Event-Driven Engine` 


```
# An enterprise-grade, open-source backend engine built with **NestJS**,
```

```
**TypeScript**, and **PostgreSQL**. This system provides a secure authentication
& authorization foundation featuring multi-channel auth, token lifecycle
management, defensive account lockout mechanisms, an event-driven email delivery
pipeline, and a vendor-agnostic file upload engine.
```

```
---
```

```
## 📸 Key Features & Architecture
```

```
### 1. Multi-Channel Authentication & Security
```

- `**Hybrid Authentication Mechanics:**` 

- `**Traditional Credentials:** Email + Password authentication secured with` 

```
`bcrypt` password hashing.
```

- `**Social Identity Federation:** Google OAuth 2.0 with automatic account linking. - **Passwordless Magic OTP:** 6-digit email-delivered passcodes for frictionfree authentication.` 

```
- **Token Lifecycle Management:**
```

- `Short-lived **Access Tokens** (15-minute expiration).` 

- `Single-use **Refresh Tokens** (7-day longevity) utilizing strict slidingwindow token rotation.` 

- `Automated session revocation on password modifications or explicit logouts.` 

- `**Account Lockout Defense:**` 

- `Real-time failed login attempt tracking.` 

- `Automatic 15-minute account lockout after 5 consecutive failed login attempts.` 

- `Instant security alert emails dispatched upon trigger.` 

- `**Role-Based Access Control (RBAC):**` 

- `Granular multi-tier authorization (`USER`, `ADMIN`).` 

- `Custom `@Roles()` decorator paired with `RolesGuard` metadata extraction. - **Endpoint Protection:**` 

- `Security header masking via `Helmet` (XSS, clickjacking prevention).` 

- `Dynamic CORS origin validation.` 

- `Global `ValidationPipe` for strict payload sanitization.` 

```
### 2. Asynchronous Event-Driven Engine
- **Decoupled Architecture:** Utilizes `@nestjs/event-emitter` to offload heavy
background tasks (emails, analytics) from the main HTTP request-response thread.
- **Transactional Audit Ledger:** Dedicated `email_logs` relational table
tracking every outbound email dispatch.
```

`- **State Machine Pipeline:** Full delivery lifecycle tracking: `Pending`` ➡️� ``Sent`` ➡️� ``Delivered`` ➡️� ``Opened`` ➡️� ``Clicked` - **Resilience Engineering:** Automated exponential backoff and retry mechanisms wrapping outbound third-party API calls. - **Telemetry Engine:** Real-time data parser aggregating open, bounce, and click rates.` 

```
### 3. Modular File Upload Subsystem
```

```
- **Standalone Architecture:** Vendor-agnostic file module allowing seamless
provider swaps without breaking core domain logic.
- **Memory Streaming:** Direct streaming from disk-less `Multer` buffers to
Cloudinary, ensuring zero temporary files land on the server filesystem.
```

```
---
```

`##` 🛠 `Tech Stack` 

- `**Framework:** NestJS (TypeScript)` 

- `**Database:** PostgreSQL` 

```
- **ORM:** TypeORM / Prisma
- **Security:** Passport.js, JWT, Bcrypt, Helmet
- **Event Bus:** NestJS EventEmitter2
- **File Storage:** Multer, Cloudinary
- **Containerization:** Docker & Docker Compose
```

```
---
```

```
## 📸 Getting Started
```

```
### Prerequisites
Make sure you have the following installed locally:
- [Node.js](https://nodejs.org/) (v18+ or v20+)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) & [Docker
Compose](https://docs.docker.com/compose/)
```

```
---
```

```
### Installation & Environment Setup
```

```
1. **Clone the Repository:**
   ```bash
   git clone
[https://github.com/your-username/rbac-event-engine.git](https://github.com/
your-username/rbac-event-engine.git)
   cd rbac-event-engine
```

```
    Install Dependencies:
    Bash
    npm install
    Configure Environment Variables:
    Copy the example environment configuration:
    Bash
    cp .env.example .env
    Fill in your local setup details inside .env:
    Code snippet
    # Application
    PORT=3000
    NODE_ENV=development
    # Database Configuration
    DB_HOST=localhost
    DB_PORT=5432
    DB_USERNAME=postgres
    DB_PASSWORD=postgres
    DB_NAME=rbac_db
    # JWT Tokens
    JWT_ACCESS_SECRET=your_super_secret_access_key
    JWT_ACCESS_EXPIRATION=15m
    JWT_REFRESH_SECRET=your_super_secret_refresh_key
    JWT_REFRESH_EXPIRATION=7d
    # OAuth
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

```
    # Cloudinary
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    Spin up Infrastructure (PostgreSQL):
    Bash
    docker compose up -d
    Run Database Migrations:
    Bash
    npm run migration:run
    Start Development Server:
    Bash
    npm run start:dev
```

```
    The API server will run at http://localhost:3000/api.
```

🛡 `Security Workflows Role-Based Authorization Usage` 

```
Protect routes using the @Roles() decorator and RolesGuard:
TypeScript
```

```
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('dashboard')
  @Roles(Role.ADMIN)
  getAdminDashboard() {
    return { message: 'Welcome to the privileged admin panel.' };
  }
}
📸 Testing & Quality Assurance
Bash
# Unit tests
npm run test
# End-to-end (E2E) integration tests
npm run test:e2e
# Code formatting & linting checks
npm run lint
npm run format
📸 Contributing Guidelines
```

```
We welcome open-source contributions! To keep our codebase clean and
maintainable:
```

```
    Pick an Issue: Check open issues or pick a milestone task.
```

```
    Branching Strategy: Name your feature branches cleanly: feat/feature-name,
fix/bug-fix, or chore/task-name.
```

```
    Commit Conventions: Follow Conventional Commits format (e.g., feat(auth):
implement refresh token rotation).
```

```
    Pull Requests: Ensure all unit/E2E tests pass and linting checks run cleanly
before requesting code review.
```

- `📸 License` 

```
This project is open-source and licensed under the MIT License.
```

