# OZ AI — User Guide

## Overview

**OZ AI** is available in your dashboard at `/dashboard/ai-assistant`. It provides real-time, personalised help based on your role, backed by live library data — not guesswork.

Unlike a generic chatbot, OZ AI calls the actual library database to answer questions. When you ask "how many books do we have?", it queries the database and gives you the exact number.

---

## Conversations

OZ AI remembers your conversation history. Each chat session is saved as a named conversation.

- Click **+ New Chat** in the sidebar to start a fresh conversation
- Previous conversations appear in the sidebar, sorted by most recent
- Click any conversation to resume where you left off
- Delete conversations using the trash icon

---

## For Students

### What You Can Ask

#### Finding Books
```
"Find books about machine learning"
"Search for psychology textbooks"
"Show me available books on finance"
"Do you have Clean Code by Robert Martin?"
```

#### Borrowing Information
```
"How many books can I borrow?"
"What books do I currently have borrowed?"
"When are my books due?"
"Am I close to my borrow limit?"
```

#### Library Stats
```
"How many books does the library have?"
"How many copies are available right now?"
"How many e-books do we have?"
```

#### E-Book Content
```
"Summarise the book Frankenstein"
"What does Think Python say about recursion?"
```

#### Research Help
```
"Find me books on neural networks"
"What academic resources do we have on climate change?"
"I'm writing a thesis on cognitive psychology — what can you find?"
```

#### Reading Lists
```
"Show me reading lists from my instructors"
"What reading lists are available for engineering students?"
```

### Your Limits

| Limit | Default Value |
|-------|--------------|
| Max active borrows | 5 |
| Borrow period | 14 days |
| Extensions | 2 (7 days each) |

*(Your actual policy may differ — OZ AI will tell you your exact limits.)*

### Tips

- Ask naturally — OZ AI understands conversational language
- Book titles in responses are clickable links to the catalog detail page
- Recommendations are personalised to your faculty
- Attach an image and ask OZ AI to describe it

---

## For Instructors

### What You Can Ask

#### Reading Lists
```
"How do I create a reading list?"
"What books should I add for my algorithms course?"
"Help me curate a list for freshman students"
```

#### Material Submission
```
"How do I submit a publication?"
"What's the process for uploading course materials?"
```

#### Course Resources
```
"Find textbooks for my data structures course"
"What's available in the faculty collection for advanced statistics?"
```

#### Borrowing (Extended Privileges)
```
"What's my current borrowing status?"
"When are my books due?"
```

### Your Privileges

| Privilege | Value |
|-----------|-------|
| Max active borrows | 10 |
| Borrow period | 30 days |
| Extensions | 3 (7 days each) |
| Create reading lists | Yes |
| Submit materials | Yes |

### Tips

- Students who follow you are notified when you publish a reading list
- OZ AI can suggest books to add to a reading list by topic
- Your faculty collection is prioritised in search results

---

## For Staff

### What You Can Ask

#### Catalog & Stats
```
"How many books do we have in the catalog?"
"What are the most borrowed books?"
"How many copies are available?"
```

#### Personalized Recommendations
```
"Suggest books for me"
"What should I read next based on my interests?"
"Find books about leadership"
```

#### Borrowing
```
"What books do I currently have out?"
"When are my books due?"
```

### Your Limits

| Limit | Value |
|-------|-------|
| Max active borrows | 7 |
| Borrow period | 14 days |
| Extensions | 2 (7 days each) |

### Tips

- Update your interests in your profile for better recommendations
- OZ AI reads your borrow history to personalise suggestions

---

## For Administrators

### What You Can Ask

#### System Overview
```
"How many books are in the catalog?"
"How many copies are available vs borrowed?"
"How many active borrows do we have right now?"
"What are the most borrowed books?"
```

#### Active Operations
```
"How many pending reservations are there?"
"Show me reservations ready for pickup"
"Are there any overdue borrows?"
```

#### Book Catalog
```
"Find books about [topic]"
"Show me details for book ID abc123"
"How many e-books do we have?"
```

#### Book Cover Scanning (Admin only)

From the **Add Book** page, click **Scan Cover**:
1. Upload a photo of the book cover
2. OZ AI (using `gemma3:4b` multimodal) extracts the title, authors, ISBN, publisher, and year
3. The form is auto-filled — review and save

### What OZ AI Won't Do

OZ AI provides information only — it does **not** execute write actions:

- Cannot delete or deactivate users
- Cannot approve or reject materials
- Cannot change system settings
- Cannot process returns or approvals

Use the Admin Dashboard directly for those actions.

### Your Privileges

| Privilege | Value |
|-----------|-------|
| Max borrows | Unlimited |
| Borrow period | 60 days |
| Extensions | Unlimited |
| System-wide data access | Full (via tools) |

---

## Quick Reference (All Roles)

### Example Prompts by Category

| Category | Example Prompt |
|----------|---------------|
| Book search | "Find books about [topic]" |
| Book lookup | "Find me Clean Code" |
| Catalog stats | "How many books do we have?" |
| My borrows | "What books do I have out?" |
| Due dates | "When are my books due?" |
| E-book | "Summarise [book title]" |
| Web lookup | "Fetch this URL and summarise it: [url]" |
| Help | "What can you help me with?" |

### Status Indicator

The OZ AI header shows your connection status:

| Badge | Meaning |
|-------|---------|
| 🟢 **AI Online** | Ollama is running — full capabilities available |
| 🟡 **Basic Mode** | Ollama unavailable — limited responses only |

### Offline / Basic Mode

When Ollama is unavailable:
- OZ AI cannot answer questions that require the LLM
- Tool calls that go directly to the database (catalog stats, borrows) may still work
- The "Basic Mode" amber pill appears in the chat header
- Start Ollama and refresh to restore full capabilities

---

## Privacy

- All conversations are processed locally — no data leaves your server
- No data is sent to external AI providers
- OZ AI only accesses your own library data (borrows, reservations)
- Conversation history is stored in the database and visible only to you
- Admins can access system-wide data (borrows, reservations) through the appropriate tools
