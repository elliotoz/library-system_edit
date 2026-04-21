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
    query: 'I work in IT. Can you recommend books on cloud infrastructure and security?',
    thinking: 'Staff from IT department looking for professional resources. Search for relevant books.',
    response: `Found **22 books** on cloud infrastructure and IT security:

**Recommended for Your Role:**
- "Designing Data-Intensive Applications" — cloud architecture foundations
- "The Phoenix Project" — IT operations excellence

All available now. Would you like more on a specific topic like AWS, Kubernetes, or network security?`,
  },
  {
    query: 'What are my current borrows?',
    thinking: 'Staff asking about their own borrows. Use get_my_borrows tool.',
    response: `You currently have 2 active borrows:

- "Cloud Security and Compliance" — due in 5 days
- "Strategic Financial Planning" — due in 11 days

No overdue books. Would you like to know about extensions?`,
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
