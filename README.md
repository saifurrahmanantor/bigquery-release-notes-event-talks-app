# BigQuery Release Notes Explorer & Tweet Composer

A premium, modern web application that fetches Google Cloud's BigQuery release notes feed, formats updates into individual, category-coded cards, and provides a built-in Tweet Composer to format and post updates directly to X (Twitter).

Built with **Python Flask** (backend) and **Vanilla HTML, CSS, and JavaScript** (frontend).

---

## ✨ Features

- **Semantic Feed Segmentation**: BigQuery release notes combine a single day's updates into one block. This app automatically splits daily entries by `<h3>` tags, allowing users to select and Tweet about a *specific* update instead of an entire day's log.
- **In-Memory Caching**: Caches the parsed feed for 10 minutes to minimize latency and prevent rate-limiting on external feeds.
- **Manual Force-Refresh**: A refresh button with a glowing icon and skeleton load screen shimmers bypasses the cache to pull fresh XML.
- **Interactive Tweet Composer**: Click on any release card to automatically draft a custom tweet. It pre-populates character count limits based on X's standards (URLs count as exactly 23 characters).
- **Mock X Preview**: Shows a real-time visualization of your tweet layout and metadata preview box.
- **X Web Intent Integration**: Instantly posts your customized draft to X in a new browser tab.
- **Real-Time Search & Filters**: Search updates by keyword/date, or click metric chips to filter by category (*Feature*, *Announcement*, *Issue*, *Changed*, etc.).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.x, Flask (Microframework)
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom design system, glassmorphism, responsive grid), Vanilla ES6+ JavaScript (State management, API integration, DOM rendering)
- **APIs & Feeds**: Google Cloud BigQuery RSS Feed, Twitter/X Web Intent API

---

## 📂 Folder Structure

```text
bigquery_release_notes_app/
├── app.py                 # Flask server, Atom XML scraper, cache manager
├── .gitignore             # Git ignore patterns (venv, __pycache__, IDE settings)
├── README.md              # Project documentation
├── templates/
│   └── index.html         # Main dashboard layout
└── static/
    ├── css/
    │   └── style.css      # Dark theme UI, skeleton shimmers, circular countdowns
    └── js/
        └── app.js         # State machine, local index search, Twitter intent generator
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Python 3.x** installed on your system.

### 2. Clone/Copy the Code
Navigate to the directory containing the project files:
```bash
cd C:\Users\Saifur\bigquery_release_notes_app
```

### 3. Install Dependencies
Install Flask using pip:
```bash
pip install flask
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```

### 5. Access the Web App
Open your web browser and navigate to:
[http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 🔄 How it Works

1. **Feed Fetching**: The Flask server requests the XML feed from `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
2. **Parsing**: A custom [ReleaseContentParser](app.py) splits the combined entries into standalone update items.
3. **Frontend Render**: The client fetches the parsed updates from `/api/releases`, displaying them in a high-fidelity timeline alongside metrics.
4. **Tweet Selection**: Clicking an update triggers a visual selection state and loads the draft into the composer. Text lengths are counted dynamically and the circular progress indicator updates dynamically.
5. **Publishing**: Clicking "Post to X" opens a new tab directed to X's Web Intent interface.
