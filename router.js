const express = require("express");
const router = express.Router();
const {
  authenticate,
  adminOnly,
  teacherOnly,
  studentOnly,
} = require("./middleware/auth");

// Import controllers
const userController = require("./controllers/userController");
const studentController = require("./controllers/studentController");
const teacherController = require("./controllers/teacherController");
const courseController = require("./controllers/courseController");
const courseContentController = require("./controllers/courseContentController");
const batchController = require("./controllers/batchController");
const classController = require("./controllers/classController");
const reviewController = require("./controllers/reviewController");
const enrollmentController = require("./controllers/enrollmentController");
const favoriteController = require("./controllers/favoriteController");
const paymentController = require("./controllers/paymentController");
const followController = require("./controllers/followController");
const postController = require("./controllers/postController");
const adminController = require("./controllers/adminController");

const pathwayController = require("./controllers/pathwayController");
const mcqAttemptController      = require("./controllers/mcqAttemptController");
const activityAttemptController = require("./controllers/activityAttemptController");

const aiController = require("./controllers/aiController");


// Routes
// AI routes (math canvas)
router.post("/api/ai/generate-question", authenticate, aiController.generateQuestion);
router.post("/api/ai/solve-math", authenticate, aiController.solveMath);
router.post("/api/ai/check-answer", authenticate, aiController.checkAnswer);

// Authentication routes
router.post("/api/users/login", userController.login);
router.post("/api/users/register", userController.register);
router.post("/api/users/google-auth", userController.googleAuth);
router.get("/api/users/me", authenticate, userController.getMe);

// User routes
router.get("/api/users", authenticate, adminOnly, userController.getUsers);
router.post("/api/users", authenticate, adminOnly, userController.createUser);
router.get("/api/users/:id", authenticate, userController.getUserById);
router.get(
  "/api/users/email/:email",
  authenticate,
  userController.getUserByEmail,
);

router.get("/api/students", authenticate, studentController.getStudents);
router.post("/api/students", studentController.createStudent);
router.get(
  "/api/students/email/:email",
  authenticate,
  studentController.getStudentByEmail,
);
router.get(
  "/api/students/user/:userId",
  authenticate,
  studentController.getStudentByUserId,
);
router.get("/api/students/:id", authenticate, studentController.getStudentById);
router.put(
  "/api/students/:id",
  authenticate,
  studentOnly,
  studentController.updateStudent,
);

router.get("/api/teachers", teacherController.getTeachers);
router.post("/api/teachers", teacherController.createTeacher);
router.get(
  "/api/teachers/email/:email",
  authenticate,
  teacherController.getTeacherByEmail,
);
router.get(
  "/api/teachers/user/:userId",
  authenticate,
  teacherController.getTeacherByUserId,
);
router.get("/api/teachers/:id", teacherController.getTeacherById);
router.put(
  "/api/teachers/:id",
  authenticate,
  teacherOnly,
  teacherController.updateTeacher,
);

router.get("/api/courses", courseController.getCourses);
router.post(
  "/api/courses",
  authenticate,
  adminOnly,
  courseController.createCourse,
);
router.get("/api/courses/featured", courseController.getFeaturedCourses);
router.get("/api/courses/code/:code", courseController.getCourseByCode);
router.get(
  "/api/courses/coordinator/:coordinatorId",
  courseController.getCoursesByCoordinator,
);
router.get(
  "/api/courses/instructor/:instructorId",
  courseController.getCoursesByInstructor,
);
router.get("/api/courses/:id", courseController.getCourseById);

router.put(
  "/api/courses/:id",
  authenticate,
  adminOnly,
  courseController.updateCourse,
);

router.delete(
  "/api/courses/:id",
  authenticate,
  adminOnly,
  courseController.deleteCourse,
);

router.get("/api/course-contents", courseContentController.getCourseContents);
router.post(
  "/api/course-contents",
  authenticate,
  teacherOnly,
  courseContentController.createCourseContent,
);
router.get(
  "/api/course-contents/:id",
  courseContentController.getCourseContentById,
);
router.get(
  "/api/course-contents/course/:courseId",
  courseContentController.getContentsByCourseId,
);

router.put(
  "/api/course-contents/:id",
  authenticate,
  teacherOnly,
  courseContentController.updateCourseContent,
);

router.delete(
  "/api/course-contents/:id",
  authenticate,
  teacherOnly,
  courseContentController.deleteCourseContent,
);

router.get("/api/reviews", reviewController.getReviews);
router.post(
  "/api/reviews",
  authenticate,
  studentOnly,
  reviewController.createReview,
);
router.get("/api/reviews/:id", reviewController.getReviewById);
router.get(
  "/api/reviews/course/:courseId",
  reviewController.getReviewsByCourse,
);
router.put(
  "/api/reviews/:id",
  authenticate,
  studentOnly,
  reviewController.updateReview,
);
router.delete("/api/reviews/:id", authenticate, reviewController.deleteReview);

router.get("/api/batches", batchController.getBatches);
router.post(
  "/api/batches",
  authenticate,
  adminOnly,
  batchController.createBatch,
);
router.get("/api/batches/:id", batchController.getBatchById);
router.put(
  "/api/batches/:id",
  authenticate,
  adminOnly,
  batchController.updateBatch,
);
router.delete(
  "/api/batches/:id",
  authenticate,
  adminOnly,
  batchController.deleteBatch,
);
router.get("/api/batches/course/:courseId", batchController.getBatchesByCourse);

router.get("/api/classes", classController.getClasses);
router.post(
  "/api/classes",
  authenticate,
  teacherOnly,
  classController.createClass,
);
router.get("/api/classes/:id", classController.getClassById);
router.put(
  "/api/classes/:id",
  authenticate,
  teacherOnly,
  classController.updateClass,
);
router.delete(
  "/api/classes/:id",
  authenticate,
  teacherOnly,
  classController.deleteClass,
);
router.get("/api/classes/course/:courseId", classController.getClassesByCourse);
router.get("/api/classes/batch/:batchId", classController.getClassesByBatch);

// Enrollment routes
router.get(
  "/api/enrollments",
  authenticate,
  enrollmentController.getEnrollments,
);
router.post(
  "/api/enrollments",
  authenticate,
  enrollmentController.createEnrollment,
);
router.get(
  "/api/enrollments/:id",
  authenticate,
  enrollmentController.getEnrollmentById,
);
router.get(
  "/api/enrollments/student/:studentId",
  authenticate,
  enrollmentController.getEnrollmentsByStudent,
);
router.get(
  "/api/enrollments/user/:userId",
  authenticate,
  enrollmentController.getEnrollmentsByUser,
);
router.get(
  "/api/enrollments/course/:courseId",
  authenticate,
  enrollmentController.getEnrollmentsByCourse,
);
router.put(
  "/api/enrollments/:id",
  authenticate,
  enrollmentController.updateEnrollment,
);
router.delete(
  "/api/enrollments/:id",
  authenticate,
  adminOnly,
  enrollmentController.deleteEnrollment,
);

// Favorite routes
router.get("/api/favorites", authenticate, favoriteController.getFavorites);
router.post("/api/favorites", authenticate, favoriteController.createFavorite);
router.get(
  "/api/favorites/:id",
  authenticate,
  favoriteController.getFavoriteById,
);
router.get(
  "/api/favorites/user/:userId",
  authenticate,
  favoriteController.getFavoritesByUserId,
);
router.get(
  "/api/favorites/check/:userId/:courseId",
  authenticate,
  favoriteController.checkFavorite,
);
router.delete(
  "/api/favorites/:id",
  authenticate,
  favoriteController.deleteFavorite,
);
router.delete(
  "/api/favorites/user/:userId/course/:courseId",
  authenticate,
  favoriteController.removeFavoriteByUserAndCourse,
);

// Payment routes
router.post(
  "/api/payments/hash",
  authenticate,
  paymentController.generatePaymentHash,
);
router.post(
  "/api/payments/verify",
  paymentController.verifyPayment, // No auth - called by PayHere
);
router.post(
  "/api/payments/confirm",
  authenticate,
  paymentController.confirmPayment,
);
router.get(
  "/api/payments/details/:courseId/:userId",
  authenticate,
  paymentController.getPaymentDetails,
);
router.post(
  "/api/payments/enrollment/pending",
  authenticate,
  paymentController.createPaymentPendingEnrollment,
);

// Follow routes
router.post(
  "/api/follows",
  authenticate,
  studentOnly,
  followController.followTeacher,
);
router.delete(
  "/api/follows",
  authenticate,
  studentOnly,
  followController.unfollowTeacher,
);
router.get(
  "/api/follows/check/:student_id/:teacher_id",
  authenticate,
  followController.checkFollowing,
);
router.get(
  "/api/follows/student/:student_id/teachers",
  authenticate,
  followController.getFollowingTeachers,
);
router.get(
  "/api/follows/teacher/:teacher_id/followers",
  followController.getTeacherFollowers,
);
router.get(
  "/api/follows/teacher/:teacher_id/count",
  followController.getFollowerCount,
);

// Post routes
router.get("/api/posts", postController.getPosts);
router.post("/api/posts", authenticate, teacherOnly, postController.createPost);
router.get("/api/posts/:id", postController.getPostById);
router.put(
  "/api/posts/:id",
  authenticate,
  teacherOnly,
  postController.updatePost,
);
router.delete(
  "/api/posts/:id",
  authenticate,
  teacherOnly,
  postController.deletePost,
);
router.get("/api/posts/teacher/:teacherId", postController.getPostsByTeacher);
router.get("/api/posts/course/:courseId", postController.getPostsByCourse);
router.post(
  "/api/posts/:id/like",
  authenticate,
  studentOnly,
  postController.toggleLike,
);
router.get(
  "/api/posts/:post_id/like/:student_id",
  authenticate,
  postController.checkLike,
);

// Admin routes - all require admin access
router.get(
  "/api/admin/users",
  authenticate,
  adminOnly,
  adminController.getAllUsers,
);
router.get(
  "/api/admin/stats",
  authenticate,
  adminOnly,
  adminController.getDashboardStats,
);
router.get(
  "/api/admin/enrollments",
  authenticate,
  adminOnly,
  adminController.getAllEnrollments,
);
router.get(
  "/api/admin/enrollments/paid",
  authenticate,
  adminOnly,
  adminController.getPaidEnrollments,
);
router.get(
  "/api/admin/enrollments/stats",
  authenticate,
  adminOnly,
  adminController.getEnrollmentStats,
);
router.get(
  "/api/admin/students",
  authenticate,
  adminOnly,
  adminController.getAllStudentsWithEnrollments,
);
router.put(
  "/api/admin/users/:userId/role",
  authenticate,
  adminOnly,
  adminController.updateUserRole,
);
router.delete(
  "/api/admin/users/:userId",
  authenticate,
  adminOnly,
  adminController.deleteUser,
);

// Pathway routes
router.get("/api/pathways", pathwayController.getPathways);
router.get("/api/pathways/published", pathwayController.getPublishedPathways);
router.get("/api/pathways/:id", pathwayController.getPathwayById);
router.post("/api/pathways", authenticate, adminOnly, pathwayController.createPathway);
router.put("/api/pathways/:id", authenticate, adminOnly, pathwayController.updatePathway);
router.delete("/api/pathways/:id", authenticate, adminOnly, pathwayController.deletePathway);

// MCQ Attempt routes
router.post("/api/mcq-attempts", authenticate, mcqAttemptController.submitAttempt);
router.get(
  "/api/mcq-attempts/questions/:userId/:contentId",
  authenticate,
  mcqAttemptController.getQuizQuestions,
);
router.get(
  "/api/mcq-attempts/user/:userId/course/:courseId",
  authenticate,
  mcqAttemptController.getAttemptsByUserAndCourse,
);
router.get(
  "/api/mcq-attempts/user/:userId/content/:contentId",
  authenticate,
  mcqAttemptController.getAttemptsByUserAndContent,
);

// Activity Attempt routes
router.post("/api/activity-attempts", authenticate, activityAttemptController.submitAttempt);
router.get(
  "/api/activity-attempts/user/:userId/course/:courseId",
  authenticate,
  activityAttemptController.getAttemptsByUserAndCourse,
);
router.get(
  "/api/activity-attempts/user/:userId/content/:contentId",
  authenticate,
  activityAttemptController.getAttemptsByUserAndContent,
);

router.use("/api/meetings", require("./meetings"));

module.exports = router;
