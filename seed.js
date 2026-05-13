const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Teacher = require("./models/Teacher");
const Course = require("./models/Course");
const CourseContent = require("./models/CourseContent");
const Review = require("./models/Review");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bliit";

// Sample data
const sampleTeachers = [
  {
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@bliit.edu",
    profile_image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces",
    phone_number: "+1234567890",
    specialization: "Web Development",
    bio: "Full-stack developer with 10+ years of experience in teaching modern web technologies.",
  },
  {
    name: "Prof. Michael Chen",
    email: "michael.chen@bliit.edu",
    profile_image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces",
    phone_number: "+1234567891",
    specialization: "Data Science",
    bio: "Data scientist and researcher specializing in machine learning and AI.",
  },
  {
    name: "Emma Williams",
    email: "emma.williams@bliit.edu",
    profile_image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=faces",
    phone_number: "+1234567892",
    specialization: "UI/UX Design",
    bio: "Award-winning designer with expertise in user-centered design and prototyping.",
  },
  {
    name: "David Martinez",
    email: "david.martinez@bliit.edu",
    profile_image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces",
    phone_number: "+1234567893",
    specialization: "Mobile Development",
    bio: "iOS and Android developer passionate about creating beautiful mobile experiences.",
  },
  {
    name: "Dr. Lisa Anderson",
    email: "lisa.anderson@bliit.edu",
    profile_image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces",
    phone_number: "+1234567894",
    specialization: "Cybersecurity",
    bio: "Security expert with a focus on ethical hacking and network security.",
  },
];

const sampleCourses = [
  {
    courseCode: "WEB101",
    courseName: "Complete Web Development Bootcamp",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop",
    description:
      "Master web development from scratch. Learn HTML, CSS, JavaScript, React, Node.js, and deploy real-world projects.",
    courseFee: 129.99,
    limitedTimeOffer: true,
    limitedTimeOfferPrice: 89.99,
    category: "Development",
    skill_level: "Beginner",
    lessons: 45,
    duration: "12 weeks",
    rate: 4.8,
    enrolled: 1234,
    featured: true,
  },
  {
    courseCode: "DS201",
    courseName: "Data Science & Machine Learning",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    description:
      "Dive into data science with Python. Learn pandas, NumPy, scikit-learn, and build ML models.",
    courseFee: 149.99,
    limitedTimeOffer: true,
    limitedTimeOfferPrice: 99.99,
    category: "Data Science",
    skill_level: "Intermediate",
    lessons: 52,
    duration: "14 weeks",
    rate: 4.9,
    enrolled: 987,
    featured: true,
  },
  {
    courseCode: "UX301",
    courseName: "UI/UX Design Masterclass",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop",
    description:
      "Create stunning user interfaces and experiences. Master Figma, design systems, and user research.",
    courseFee: 119.99,
    limitedTimeOffer: false,
    category: "Design",
    skill_level: "Beginner",
    lessons: 38,
    duration: "10 weeks",
    rate: 4.7,
    enrolled: 756,
    featured: true,
  },
  {
    courseCode: "MOB401",
    courseName: "React Native Mobile Development",
    image:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop",
    description:
      "Build native mobile apps for iOS and Android using React Native and Expo.",
    courseFee: 139.99,
    limitedTimeOffer: true,
    limitedTimeOfferPrice: 94.99,
    category: "Development",
    skill_level: "Intermediate",
    lessons: 42,
    duration: "11 weeks",
    rate: 4.6,
    enrolled: 643,
    featured: true,
  },
  {
    courseCode: "SEC501",
    courseName: "Ethical Hacking & Penetration Testing",
    image:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=600&fit=crop",
    description:
      "Learn ethical hacking techniques, penetration testing, and secure coding practices.",
    courseFee: 159.99,
    limitedTimeOffer: false,
    category: "Business",
    skill_level: "Advanced",
    lessons: 48,
    duration: "13 weeks",
    rate: 4.9,
    enrolled: 521,
    featured: true,
  },
  {
    courseCode: "JS102",
    courseName: "Advanced JavaScript & TypeScript",
    image:
      "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800&h=600&fit=crop",
    description:
      "Master modern JavaScript ES6+, async programming, and TypeScript for scalable applications.",
    courseFee: 99.99,
    limitedTimeOffer: true,
    limitedTimeOfferPrice: 69.99,
    category: "Development",
    skill_level: "Intermediate",
    lessons: 35,
    duration: "9 weeks",
    rate: 4.8,
    enrolled: 892,
    featured: false,
  },
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    console.log("Clearing existing data...");
    await User.deleteMany({});
    await Teacher.deleteMany({});
    await Course.deleteMany({});
    await CourseContent.deleteMany({});
    await Review.deleteMany({});
    console.log("Existing data cleared");

    // Create users for teachers
    console.log("Creating teacher users...");
    const userPromises = sampleTeachers.map((teacher) => {
      const user = new User({
        name: teacher.name,
        email: teacher.email,
        profile_image: teacher.profile_image,
        role: "teacher",
        type: "teacher",
      });
      return user.save();
    });
    const users = await Promise.all(userPromises);
    console.log(`Created ${users.length} teacher users`);

    // Create teachers
    console.log("Creating teachers...");
    const teacherPromises = sampleTeachers.map((teacherData, index) => {
      const teacher = new Teacher({
        user_id: users[index]._id,
        name: teacherData.name,
        email: teacherData.email,
        profile_image: teacherData.profile_image,
        phone_number: teacherData.phone_number,
        specialization: teacherData.specialization,
        bio: teacherData.bio,
      });
      return teacher.save();
    });
    const teachers = await Promise.all(teacherPromises);
    console.log(`Created ${teachers.length} teachers`);

    // Create courses with teacher coordinators
    console.log("Creating courses...");
    const coursePromises = sampleCourses.map((courseData, index) => {
      const course = new Course({
        ...courseData,
        coordinator: users[index % users.length]._id,
        instructor_id: teachers[index % teachers.length]._id,
      });
      return course.save();
    });
    const courses = await Promise.all(coursePromises);
    console.log(`Created ${courses.length} courses`);

    // Create sample course contents
    console.log("Creating course contents...");
    const contentPromises = [];
    courses.forEach((course, courseIndex) => {
      // Create 5-8 content items per course
      const numContents = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numContents; i++) {
        const content = new CourseContent({
          course_id: course._id,
          title: `Module ${i + 1}: ${getModuleTitle(courseIndex, i)}`,
          description: `Learn about ${getModuleTitle(courseIndex, i).toLowerCase()} in this comprehensive module.`,
          content_type:
            i % 3 === 0 ? "video" : i % 3 === 1 ? "document" : "quiz",
          content_url: `https://example.com/content/${course.courseCode}-module-${i + 1}`,
          duration: `${20 + Math.floor(Math.random() * 40)} minutes`,
          order: i + 1,
        });
        contentPromises.push(content.save());
      }
    });
    const contents = await Promise.all(contentPromises);
    console.log(`Created ${contents.length} course content items`);

    // Create sample reviews
    console.log("Creating sample reviews...");
    const sampleReviewers = [
      { name: "Alice Cooper", email: "alice@example.com" },
      { name: "Bob Smith", email: "bob@example.com" },
      { name: "Carol White", email: "carol@example.com" },
      { name: "Dan Brown", email: "dan@example.com" },
    ];

    const reviewerUsers = await Promise.all(
      sampleReviewers.map((reviewer) => {
        const user = new User({
          name: reviewer.name,
          email: reviewer.email,
          role: "student",
          type: "student",
        });
        return user.save();
      }),
    );

    const reviewPromises = [];
    courses.forEach((course) => {
      // Create 2-4 reviews per course
      const numReviews = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numReviews; i++) {
        const review = new Review({
          course_id: course._id,
          user_id: reviewerUsers[i % reviewerUsers.length]._id,
          rating: 4 + Math.floor(Math.random() * 2), // 4 or 5 stars
          review_text: getReviewText(i),
          created_at: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          ), // Random date within last 30 days
        });
        reviewPromises.push(review.save());
      }
    });
    const reviews = await Promise.all(reviewPromises);
    console.log(`Created ${reviews.length} reviews`);

    console.log("\n✅ Database seeded successfully!");
    console.log(`\nSummary:`);
    console.log(`- ${users.length + reviewerUsers.length} users`);
    console.log(`- ${teachers.length} teachers`);
    console.log(`- ${courses.length} courses`);
    console.log(`- ${contents.length} course contents`);
    console.log(`- ${reviews.length} reviews`);

    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

function getModuleTitle(courseIndex, moduleIndex) {
  const modules = [
    [
      "Introduction to HTML",
      "CSS Fundamentals",
      "JavaScript Basics",
      "React Essentials",
      "Node.js Backend",
      "Database Design",
      "API Development",
      "Deployment",
    ],
    [
      "Python Basics",
      "Data Analysis with Pandas",
      "Data Visualization",
      "Statistics for DS",
      "Machine Learning",
      "Deep Learning",
      "Model Deployment",
      "Real-world Projects",
    ],
    [
      "Design Principles",
      "Figma Basics",
      "User Research",
      "Wireframing",
      "Prototyping",
      "Design Systems",
      "Usability Testing",
      "Portfolio Building",
    ],
    [
      "React Native Setup",
      "Components & Props",
      "Navigation",
      "State Management",
      "API Integration",
      "Native Modules",
      "Publishing Apps",
      "Performance",
    ],
    [
      "Security Fundamentals",
      "Network Scanning",
      "Vulnerability Analysis",
      "Exploitation Techniques",
      "Web Application Security",
      "Wireless Security",
      "Social Engineering",
      "Security Reporting",
    ],
    [
      "ES6+ Features",
      "Async Programming",
      "TypeScript Basics",
      "Advanced Types",
      "Design Patterns",
      "Testing",
      "Performance",
      "Best Practices",
    ],
  ];
  return (
    modules[courseIndex % modules.length][moduleIndex] ||
    `Topic ${moduleIndex + 1}`
  );
}

function getReviewText(index) {
  const reviews = [
    "Excellent course! The instructor explains everything clearly and the projects are very practical.",
    "Really enjoyed this course. Learned a lot and already applying it in my work.",
    "Great content and well-structured. Highly recommend for anyone looking to level up their skills.",
    "Best course I've taken! The instructor is knowledgeable and the community is very supportive.",
  ];
  return reviews[index % reviews.length];
}

// Run the seed function
seedDatabase();
