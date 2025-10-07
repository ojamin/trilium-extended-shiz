# Task Dashboard Configuration

```json
{
  "title": "My Task Dashboard",
  "rootNoteId": "<noteId>",
  "depth": 3,
  "view": "list", // list | kanban | calendar | overview
  "filters": {
    "status": ["backlog", "in-progress", "blocked"],
    "tags": [],
    "showCompleted": false,
    "includeDescendants": true
  },
  "kanban": {
    "columns": [
      { "id": "backlog", "label": "Backlog" },
      { "id": "todo", "label": "To Do" },
      { "id": "in-progress", "label": "In Progress" },
      { "id": "blocked", "label": "Blocked" },
      { "id": "done", "label": "Done" }
    ]
  },
  "calendar": {
    "range": "month", // currently only "month" is rendered in the UI
    "showOverdue": true // reserved for future use
  },
  "overview": {
    "insights": ["statusBreakdown", "dueSoon", "recentActivity"]
  }
}
```

Update `rootNoteId` to the note that anchors this dashboard. Adjust filters and view layout as needed. After saving the note, convert it to a **Render Note**, add label `taskDashboard=true`, and set relation `~renderNote=<Task Dashboard HTML noteId>` so it renders through the shared HTML + frontend script.
