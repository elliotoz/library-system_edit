# AI Assistant User Guide

## Overview

The AI Assistant is available in your dashboard at `/dashboard/ai-assistant`. It provides personalized help based on your role in the library system.

---

## For Students

### What You Can Ask

#### Finding Books
```
"Find books about machine learning"
"Search for psychology textbooks"
"Show me available books on finance"
"Recommend books for beginners in programming"
```

#### Borrowing Information
```
"How many books can I borrow?"
"When are my books due?"
"Can I extend my borrow?"
"What's my borrowing limit?"
```

#### Reservations
```
"What's the status of my reservation?"
"Do I have any books ready for pickup?"
"How do I reserve a book?"
```

#### Learning Paths
```
"Create a learning path for data science"
"What should I read to learn web development?"
"Study plan for algorithms"
```

#### Research Help
```
"Research on artificial intelligence"
"Find academic resources for my thesis"
"Literature on cognitive psychology"
```

#### Reading Lists
```
"Show me reading lists from my instructors"
"What reading lists are available?"
"Find reading lists about economics"
```

### Your Limits

| Limit | Value |
|-------|-------|
| Max books | 5 at a time |
| Borrow period | 14 days |
| Extensions | 2 (7 days each) |

### Tips

- Ask naturally - the AI understands conversational language
- It shows relevant links to dashboard pages
- Recommendations are personalized to your faculty
- Follow instructors to see their reading lists

---

## For Instructors

### What You Can Ask

#### Reading Lists
```
"How do I create a reading list?"
"Show me my reading lists"
"What books should I add for my algorithms course?"
"Help me curate a list for freshman students"
```

#### Material Submission
```
"How do I submit a publication?"
"What's the process for uploading course materials?"
"Can I share my research paper with students?"
```

#### Course Resources
```
"Find books for my data structures course"
"Recommend textbooks for advanced statistics"
"What's available in the faculty collection?"
```

#### Borrowing (Extended Privileges)
```
"How many books can I borrow?"
"What's my borrowing status?"
"When are my books due?"
```

#### Research Assistance
```
"Research resources on neural networks"
"Academic literature on cognitive science"
"Help with research methodology books"
```

### Your Privileges

| Privilege | Value |
|-----------|-------|
| Max books | 10 at a time |
| Borrow period | 30 days |
| Extensions | 3 (7 days each) |
| Create reading lists | Yes |
| Submit materials | Yes |

### Tips

- Students who follow you get notified when you publish
- The AI can help you find books to add to reading lists
- Your faculty collection is prioritized in recommendations

---

## For Staff

### First Time Setup

When you first use the AI assistant, it will ask about your interests:

```
AI: "Hi! To give you personalized recommendations, I need to know your interests.
     Please tell me your areas of interest (e.g., 'finance, technology, history')."

You: "finance, technology, history, self-help"

AI: "Great! I've saved your interests: finance, technology, history, self-help.
     Now I can give you personalized recommendations."
```

### What You Can Ask

#### Personalized Recommendations
```
"Suggest books for me"
"What should I read next?"
"Find books about my interests"
"New arrivals I might like"
```

#### Borrowing
```
"How many books can I borrow?"
"What's my borrowing status?"
"When are my books due?"
```

#### Catalog Search
```
"Find books about leadership"
"Search for productivity books"
"Available books on management"
```

#### Reading Lists
```
"Show me popular reading lists"
"Reading lists about business"
"What are instructors recommending?"
```

#### Update Interests

Just type a new comma-separated list anytime:
```
"technology, blockchain, AI, productivity"
```

The AI will automatically update your preferences.

### Your Limits

| Limit | Value |
|-------|-------|
| Max books | 7 at a time |
| Borrow period | 14 days |
| Extensions | 2 (7 days each) |

### Tips

- Keep your interests updated for better recommendations
- The AI remembers your reading history for personalization
- Try following instructors whose interests match yours

---

## For Administrators

### What You Can Ask

#### System Overview
```
"How is the library doing?"
"Give me a system overview"
"What's the current status?"
"Dashboard summary"
```

#### Reservations
```
"How many pending reservations?"
"Reservation status overview"
"Any reservations needing attention?"
```

#### Loans & Overdue
```
"How many active loans?"
"Show me overdue statistics"
"Any overdue books?"
"Loan trends"
```

#### User Management
```
"How many active users?"
"User statistics"
"User management overview"
```

#### Catalog Management
```
"How many books in the catalog?"
"Available copies count"
"Popular categories"
```

#### Reading Lists
```
"How many published reading lists?"
"Reading list moderation status"
```

#### Analytics
```
"Analyze borrowing trends"
"Compare this month to last month"
"What insights can you give me?"
"Forecast demand"
```

### What the AI Won't Do

The AI provides information only - it does NOT execute actions:

- Delete or deactivate users
- Approve or reject materials
- Change system settings
- Modify books or reservations

For these actions, use the Admin Dashboard directly.

### Your Privileges

| Privilege | Value |
|-----------|-------|
| Max books | Unlimited |
| Borrow period | 60 days |
| Extensions | Unlimited |
| System visibility | Full |
| AI model | llama3 (most capable) |

### Tips

- The AI uses the most capable model for complex queries
- Ask "why" questions for deeper analysis
- It can compare trends and provide forecasts
- All links provided go to admin pages

---

## Quick Reference (All Roles)

### Example Prompts by Category

| Category | Example |
|----------|---------|
| Search | "Find books about [topic]" |
| Borrowing | "How many books can I borrow?" |
| Reservations | "Do I have any pickups ready?" |
| Learning | "Learning path for [topic]" |
| Research | "Research on [topic]" |
| Help | "What can you help me with?" |

### Response Indicators

| Badge | Meaning |
|-------|---------|
| `rule-based` | Fast, keyword-matched response |
| `phi3` | Lightweight model, quick responses |
| `qwen2.5` | Balanced model, most common |
| `llama3` | Advanced model, complex queries |
| `system` | Internal operation (e.g., saving interests) |

### Source Links

Responses include clickable links to relevant pages:
- Catalog
- Borrowed
- Reservations
- Reading Lists

---

## Offline Mode

If the AI server (Ollama) is unavailable:

- The assistant still works
- Uses rule-based responses (pre-programmed answers)
- You'll see "rule-based" as the model
- All core features remain functional

The experience is slightly less natural, but all essential functionality works.

---

## Privacy

- All conversations are processed locally
- No data is sent to external servers
- The AI only accesses your own library data
- Conversations are not stored permanently
