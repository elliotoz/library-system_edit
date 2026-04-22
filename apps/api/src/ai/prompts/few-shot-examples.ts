export const STUDENT_EXAMPLES = [
  {
    query: 'I need books for my essay on climate change',
    thinking: 'Student is looking for reading material. I should search the catalog and explain why these books are relevant to their topic.',
    response: `I found several books on climate change:

**Most Relevant:**
- "Climate Change: A Very Short Introduction" by Mark Maslin — covers fundamentals clearly
- "The Uninhabitable Earth" by David Wallace-Wells — explores impacts in detail

These are good starting points. Would you like me to find more specific books on a particular aspect like mitigation strategies or climate policy?`,
  },
  {
    query: 'How many days can I borrow a book for?',
    thinking: 'Policy question. I have their borrow policy in context. Answer directly with their specific limits.',
    response: `As a student, you can:
- Borrow up to **5 books** at a time
- Keep each book for **14 days**
- Request up to **2 extensions** of **7 days** each (if no one else is waiting)`,
  },
];

export const INSTRUCTOR_EXAMPLES = [
  {
    query: 'Build a reading list for a course on machine learning fundamentals',
    thinking: 'Instructor wants to create course materials. I should search for foundational ML books and organize by topic.',
    response: `Here's a suggested progression for **ML Fundamentals**:

**Foundation (Week 1-2):**
- "Introduction to Statistical Learning" — practical foundations

**Theory (Week 3-5):**
- "Pattern Recognition and Machine Learning" — deeper understanding

**Applications (Week 6-8):**
- "Hands-On Machine Learning with Scikit-Learn & TensorFlow" — real-world practice`,
  },
  {
    query: 'Which of my reading list books are most popular with students?',
    thinking: 'Instructor wants analytics on reading list usage. I have tools to get borrow data and can correlate with their lists.',
    response: `Let me check the borrow data for your reading lists...

Based on active borrows, the most popular titles this semester are:
1. "Introduction to Statistical Learning" — borrowed 12 times
2. "Hands-On Machine Learning" — borrowed 8 times

These high-demand books may benefit from additional copies.`,
  },
];

export const STAFF_EXAMPLES = [
  {
    query: 'I work in IT security. Do you have books on cloud infrastructure and security?',
    thinking: 'IT staff looking for professional resources related to their role. Search the catalog and recommend with clear relevance to their work.',
    response: `Found **22 books** on cloud infrastructure and IT security:

**Recommended for IT staff:**
- "Cloud Security and Compliance" — practical, hands-on guidance for real implementations
- "Designing Data-Intensive Applications" — foundational architecture concepts
- "The Phoenix Project" — IT operations and infrastructure management

All available now. Would you like more on a specific topic like AWS, Kubernetes, or network security?`,
  },
  {
    query: "I'm in finance. What do we have on budgeting?",
    thinking: 'Finance staff looking for work-relevant books. Search and recommend with relevance to their department.',
    response: `Found **15 books** on financial and corporate management:

**Most Relevant for Finance:**
- "Corporate Finance Fundamentals" — budget planning, forecasting, analysis
- "Financial Management Best Practices" — real-world applications
- "Strategic Financial Planning" — long-term planning and optimisation

All in stock. Which area helps your current projects most?`,
  },
  {
    query: 'How many books can I borrow?',
    thinking: 'Staff asking about their borrow policy. I have the policy in context — answer directly with their specific limits.',
    response: `As staff, you can:
- Borrow up to **8 books** at a time
- Keep each for **21 days**
- Request **3 extensions** of **7 days** each (if no one else is waiting)

Maximum time: **42 days** with all extensions. You can renew online anytime.`,
  },
];

export const ADMIN_EXAMPLES = [
  {
    query: 'How many books are currently overdue?',
    thinking: 'Admin asking for system metrics. Use get_active_borrows tool to get current status.',
    response: `Let me check the current system status...

**Current Library Status:**
- Total active borrows: 247
- Overdue borrows: 12 (5% of active)

Would you like the full overdue report or to send reminders?`,
  },
  {
    query: 'How many registered users do we have?',
    thinking: 'Admin wants user count statistics. Use get_user_stats tool.',
    response: `Here are the current user statistics:

- **Total Users:** 1,247
- **Students:** 1,089
- **Admins:** 12

Would you like a breakdown by faculty or registration date?`,
  },
];
