const express = require('express');
const router = express.Router();

// Import controllers
const userController = require('./controllers/userController');
const studentController = require('./controllers/studentController');
const teacherController = require('./controllers/teacherController');
const courseController = require('./controllers/courseController');
const courseContentController = require('./controllers/courseContentController');
const batchController = require('./controllers/batchController');
const classController = require('./controllers/classController');
const reviewController = require('./controllers/reviewController');

// Routes
router.get('/api/users', userController.getUsers);
router.post('/api/users', userController.createUser);
router.get('/api/users/:id', userController.getUserById);
router.get('/api/users/email/:email', userController.getUserByEmail);

router.get('/api/students', studentController.getStudents);
router.post('/api/students', studentController.createStudent);
router.get('/api/students/:id', studentController.getStudentById);
router.get('/api/students/email/:email', studentController.getStudentByEmail);
router.get('/api/students/user/:userId', studentController.getStudentByUserId);

router.get('/api/teachers', teacherController.getTeachers);
router.post('/api/teachers', teacherController.createTeacher);
router.get('/api/teachers/:id', teacherController.getTeacherById);
router.get('/api/teachers/email/:email', teacherController.getTeacherByEmail);
router.get('/api/teachers/user/:userId', teacherController.getTeacherByUserId);

router.get('/api/courses', courseController.getCourses);
router.post('/api/courses', courseController.createCourse);
router.get('/api/courses/:id', courseController.getCourseById);
router.get('/api/courses/code/:code', courseController.getCourseByCode);
router.get('/api/courses/coordinator/:coordinatorId', courseController.getCoursesByCoordinator);

router.put('/api/courses/:id', courseController.updateCourse);

router.delete('/api/courses/:id', courseController.deleteCourse);

router.get('/api/courses/featured', courseController.getFeaturedCourses);

router.get('/api/course-contents', courseContentController.getCourseContents);
router.post('/api/course-contents', courseContentController.createCourseContent);
router.get('/api/course-contents/:id', courseContentController.getCourseContentById);
router.get('/api/course-contents/course/:courseId', courseContentController.getContentsByCourseId);

router.put('/api/course-contents/:id', courseContentController.updateCourseContent);

router.delete('/api/course-contents/:id', courseContentController.deleteCourseContent);

router.get('/api/reviews', reviewController.getReviews);
router.post('/api/reviews', reviewController.createReview);
router.get('/api/reviews/:id', reviewController.getReviewById);
router.get('/api/reviews/course/:courseId', reviewController.getReviewsByCourse);
router.put('/api/reviews/:id', reviewController.updateReview);
router.delete('/api/reviews/:id', reviewController.deleteReview);

router.get('/api/batches', batchController.getBatches);
router.post('/api/batches', batchController.createBatch);
router.get('/api/batches/:id', batchController.getBatchById);
router.put('/api/batches/:id', batchController.updateBatch);
router.delete('/api/batches/:id', batchController.deleteBatch);
router.get('/api/batches/course/:courseId', batchController.getBatchesByCourse);

router.get('/api/classes', classController.getClasses);
router.post('/api/classes', classController.createClass);
router.get('/api/classes/:id', classController.getClassById);
router.put('/api/classes/:id', classController.updateClass);
router.delete('/api/classes/:id', classController.deleteClass);
router.get('/api/classes/course/:courseId', classController.getClassesByCourse);
router.get('/api/classes/batch/:batchId', classController.getClassesByBatch);

router.use('/api/meetings', require('./meetings'));

module.exports = router;