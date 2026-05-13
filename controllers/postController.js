const Post = require("../models/Post");
const Teacher = require("../models/Teacher");
const Course = require("../models/Course");
const PostLike = require("../models/PostLike");
const Student = require("../models/Student");

// Get all posts
exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("teacher_id")
      .populate("course_id")
      .sort({ created_at: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      message: "Error fetching posts",
      error: error.message,
    });
  }
};

// Get post by ID
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("teacher_id")
      .populate("course_id");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({
      message: "Error fetching post",
      error: error.message,
    });
  }
};

// Get posts by teacher
exports.getPostsByTeacher = async (req, res) => {
  try {
    const posts = await Post.find({ teacher_id: req.params.teacherId })
      .populate("teacher_id")
      .populate("course_id")
      .sort({ created_at: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching teacher posts:", error);
    res.status(500).json({
      message: "Error fetching teacher posts",
      error: error.message,
    });
  }
};

// Get posts by course
exports.getPostsByCourse = async (req, res) => {
  try {
    const posts = await Post.find({ course_id: req.params.courseId })
      .populate("teacher_id")
      .populate("course_id")
      .sort({ created_at: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching course posts:", error);
    res.status(500).json({
      message: "Error fetching course posts",
      error: error.message,
    });
  }
};

// Create a post
exports.createPost = async (req, res) => {
  try {
    const { teacher_id, course_id, title, content, image_url } = req.body;

    if (!teacher_id || !title || !content) {
      return res.status(400).json({
        message: "Teacher ID, title, and content are required",
      });
    }

    // Verify teacher exists
    const teacher = await Teacher.findById(teacher_id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // If course_id provided, verify it exists
    if (course_id) {
      const course = await Course.findById(course_id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
    }

    const post = await Post.create({
      teacher_id,
      course_id,
      title,
      content,
      image_url,
    });

    const populatedPost = await Post.findById(post._id)
      .populate("teacher_id")
      .populate("course_id");

    res.status(201).json({
      message: "Post created successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      message: "Error creating post",
      error: error.message,
    });
  }
};

// Update a post
exports.updatePost = async (req, res) => {
  try {
    const { title, content, image_url, course_id } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Update fields
    if (title) post.title = title;
    if (content) post.content = content;
    if (image_url !== undefined) post.image_url = image_url;
    if (course_id !== undefined) post.course_id = course_id;
    post.updated_at = Date.now();

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("teacher_id")
      .populate("course_id");

    res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({
      message: "Error updating post",
      error: error.message,
    });
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({
      message: "Error deleting post",
      error: error.message,
    });
  }
};

// Like/Unlike a post
exports.toggleLike = async (req, res) => {
  try {
    const { student_id } = req.body;
    const postId = req.params.id;

    if (!student_id) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if student already liked this post
    const existingLike = await PostLike.findOne({
      student_id,
      post_id: postId,
    });

    if (existingLike) {
      // Unlike - remove the like
      await PostLike.deleteOne({ _id: existingLike._id });
      post.likes = Math.max(0, post.likes - 1);
      await post.save();

      res.status(200).json({
        message: "Post unliked",
        likes: post.likes,
        isLiked: false,
      });
    } else {
      // Like - add the like
      await PostLike.create({ student_id, post_id: postId });
      post.likes += 1;
      await post.save();

      res.status(200).json({
        message: "Post liked",
        likes: post.likes,
        isLiked: true,
      });
    }
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({
      message: "Error toggling like",
      error: error.message,
    });
  }
};

// Check if student liked a post
exports.checkLike = async (req, res) => {
  try {
    const { student_id, post_id } = req.params;

    const like = await PostLike.findOne({ student_id, post_id });

    res.status(200).json({
      isLiked: !!like,
    });
  } catch (error) {
    console.error("Error checking like:", error);
    res.status(500).json({
      message: "Error checking like",
      error: error.message,
    });
  }
};
