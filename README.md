# BLIIT Backend

A Node.js backend application using Express and Mongoose.

## Installation

1. Clone the repository.
2. Run `npm install` to install dependencies.

## Usage

1. Ensure MongoDB is running on `mongodb://localhost:27017/bliit`.
2. Run `npm start` to start the server on port 3000.
3. For development, use `npm run dev` with nodemon.

## API Endpoints

### Users
- GET /api/users - Get all users
- POST /api/users - Create a new user
- GET /api/users/:id - Get user by ID
- GET /api/users/email/:email - Get user by email

### Students
- GET /api/students - Get all students
- POST /api/students - Create a new student
- GET /api/students/:id - Get student by ID
- GET /api/students/email/:email - Get student by email
- GET /api/students/user/:userId - Get student by user ID

### Teachers
- GET /api/teachers - Get all teachers
- POST /api/teachers - Create a new teacher
- GET /api/teachers/:id - Get teacher by ID
- GET /api/teachers/email/:email - Get teacher by email
- GET /api/teachers/user/:userId - Get teacher by user ID

### Courses
- GET /api/courses - Get all courses (returns message if no courses)
- POST /api/courses - Create a new course
- GET /api/courses/:id - Get course by ID
- PUT /api/courses/:id - Update course by ID
- DELETE /api/courses/:id - Delete course by ID
- GET /api/courses/code/:code - Get course by code
- GET /api/courses/coordinator/:coordinatorId - Get courses by coordinator ID
- GET /api/courses/featured - Get featured courses

### Course Contents
- GET /api/course-contents - Get all course contents
- POST /api/course-contents - Create new course content
- GET /api/course-contents/:id - Get course content by ID
- PUT /api/course-contents/:id - Update course content by ID
- DELETE /api/course-contents/:id - Delete course content by ID
- GET /api/course-contents/course/:courseId - Get contents by course ID

## Project Structure

- `server.js` - Main server file
- `router.js` - API routes
- `controllers/` - Controller files
- `models/` - Mongoose models