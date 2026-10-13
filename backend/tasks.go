package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type link struct {
	Type string `json:"type"`
	Key  string `json:"key"`
}
type attachment struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// task mirrors the Task interface in src/types/task.ts.
type task struct {
	ID          string       `json:"id"`
	Key         string       `json:"key"`
	Project     string       `json:"project"`
	Type        string       `json:"type"`
	Summary     string       `json:"summary"`
	Description string       `json:"description"`
	Status      string       `json:"status"`
	Priority    string       `json:"priority"`
	Order       int          `json:"order"`
	Assignee    *string      `json:"assignee"`
	Reporter    string       `json:"reporter"`
	StartDate   *string      `json:"startDate"`
	DueDate     *string      `json:"dueDate"`
	Estimate    *string      `json:"estimate"`
	StoryPoints *int         `json:"storyPoints"`
	Sprint      string       `json:"sprint"`
	Labels      []string     `json:"labels"`
	Components  []string     `json:"components"`
	FixVersion  string       `json:"fixVersion"`
	ParentKey   *string      `json:"parentKey"`
	Links       []link       `json:"links"`
	Attachments []attachment `json:"attachments"`
	Source      string       `json:"source"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
	CompletedAt *time.Time   `json:"completedAt"`
}

const taskSelect = `
SELECT t.id::text, t.key, t.project::text, t.type::text, t.summary, t.description, t.status::text, t.priority::text,
       t.position, a.username, coalesce(r.username,''), to_char(t.start_date,'YYYY-MM-DD'), to_char(t.due_date,'YYYY-MM-DD'),
       t.estimate, t.story_points, t.sprint, t.labels, t.components, t.fix_version, t.parent_key, t.source,
       t.created_at, t.updated_at, t.completed_at
FROM tasks t
LEFT JOIN user_data a ON a.id = t.assignee_id
LEFT JOIN user_data r ON r.id = t.reporter_id`

func (s *server) queryTasks(ctx context.Context, where string, args ...any) ([]task, error) {
	rows, err := s.db.Query(ctx, taskSelect+" "+where+" ORDER BY t.project, t.position, t.created_at", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []task{}
	idx := map[string]int{}
	for rows.Next() {
		var t task
		if err := rows.Scan(&t.ID, &t.Key, &t.Project, &t.Type, &t.Summary, &t.Description, &t.Status, &t.Priority,
			&t.Order, &t.Assignee, &t.Reporter, &t.StartDate, &t.DueDate, &t.Estimate, &t.StoryPoints, &t.Sprint,
			&t.Labels, &t.Components, &t.FixVersion, &t.ParentKey, &t.Source, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt); err != nil {
			return nil, err
		}
		if t.Labels == nil {
			t.Labels = []string{}
		}
		if t.Components == nil {
			t.Components = []string{}
		}
		t.Links, t.Attachments = []link{}, []attachment{}
		idx[t.ID] = len(out)
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return out, nil
	}
	lr, err := s.db.Query(ctx, `SELECT task_id::text, type::text, target_key FROM task_links`)
	if err != nil {
		return nil, err
	}
	for lr.Next() {
		var id string
		var l link
		if lr.Scan(&id, &l.Type, &l.Key) == nil {
			if i, ok := idx[id]; ok {
				out[i].Links = append(out[i].Links, l)
			}
		}
	}
	lr.Close()
	ar, err := s.db.Query(ctx, `SELECT task_id::text, name, size FROM task_attachments`)
	if err != nil {
		return nil, err
	}
	for ar.Next() {
		var id string
		var a attachment
		if ar.Scan(&id, &a.Name, &a.Size) == nil {
			if i, ok := idx[id]; ok {
				out[i].Attachments = append(out[i].Attachments, a)
			}
		}
	}
	ar.Close()
	return out, nil
}

func (s *server) listTasks(w http.ResponseWriter, r *http.Request) {
	ts, err := s.queryTasks(r.Context(), "")
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, ts)
}

func nullable(p *string) any {
	if p == nil || *p == "" {
		return nil
	}
	return *p
}

type taskInput struct {
	Project     string   `json:"project"`
	Type        string   `json:"type"`
	Summary     string   `json:"summary"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Priority    string   `json:"priority"`
	StartDate   *string  `json:"startDate"`
	DueDate     *string  `json:"dueDate"`
	Estimate    *string  `json:"estimate"`
	StoryPoints *int     `json:"storyPoints"`
	Sprint      string   `json:"sprint"`
	Labels      []string `json:"labels"`
	Components  []string `json:"components"`
	FixVersion  string   `json:"fixVersion"`
	ParentKey   *string  `json:"parentKey"`
}

var (
	validProjects   = set("AML", "EKYC", "DPDP", "WEB")
	validStatuses   = set("todo", "in_progress", "in_review", "done")
	validPriorities = set("highest", "high", "medium", "low", "lowest")
	validTypes      = set("task", "bug", "story", "epic", "subtask")
)

func set(v ...string) map[string]bool {
	m := map[string]bool{}
	for _, x := range v {
		m[x] = true
	}
	return m
}

func (s *server) createTask(w http.ResponseWriter, r *http.Request) {
	var in taskInput
	if json.NewDecoder(r.Body).Decode(&in) != nil || strings.TrimSpace(in.Summary) == "" {
		writeErr(w, 400, "summary is required")
		return
	}
	if in.Type == "" {
		in.Type = "task"
	}
	if in.Status == "" {
		in.Status = "todo"
	}
	if in.Priority == "" {
		in.Priority = "medium"
	}
	if !validProjects[in.Project] || !validStatuses[in.Status] || !validPriorities[in.Priority] || !validTypes[in.Type] {
		writeErr(w, 400, "invalid project, type, status or priority")
		return
	}
	if in.Labels == nil {
		in.Labels = []string{}
	}
	if in.Components == nil {
		in.Components = []string{}
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer tx.Rollback(ctx)
	var n int
	if err := tx.QueryRow(ctx, `UPDATE projects SET task_counter = task_counter + 1 WHERE id=$1::project_id RETURNING task_counter`, in.Project).Scan(&n); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO tasks (key, project, type, summary, description, status, priority, position, reporter_id, start_date, due_date,
		                   estimate, story_points, sprint, labels, components, fix_version, parent_key, completed_at)
		VALUES ($1, $2::project_id, $3::issue_type, $4, $5, $6::task_status, $7::task_priority,
		        (SELECT count(*) FROM tasks WHERE status=$6::task_status), $8::uuid, $9::date, $10::date,
		        $11, $12, $13, $14::text[], $15::text[], $16, $17, CASE WHEN $6='done' THEN now() END)
		RETURNING id::text`,
		fmt.Sprintf("%s-%d", in.Project, n), in.Project, in.Type, strings.TrimSpace(in.Summary), in.Description, in.Status, in.Priority,
		currentUser(r).ID, nullable(in.StartDate), nullable(in.DueDate), nullable(in.Estimate), in.StoryPoints, in.Sprint,
		in.Labels, in.Components, in.FixVersion, nullable(in.ParentKey)).Scan(&id)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	s.respondTask(w, r, id, 201)
}

func (s *server) respondTask(w http.ResponseWriter, r *http.Request, id string, code int) {
	ts, err := s.queryTasks(r.Context(), "WHERE t.id=$1::uuid", id)
	if err != nil || len(ts) == 0 {
		writeErr(w, 404, "task not found")
		return
	}
	writeJSON(w, code, ts[0])
}

func (s *server) updateTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var in struct {
		Summary     *string `json:"summary"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		Priority    *string `json:"priority"`
		StartDate   *string `json:"startDate"`
		DueDate     *string `json:"dueDate"`
		Order       *int    `json:"order"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		writeErr(w, 400, "invalid body")
		return
	}
	var sets []string
	var args []any
	add := func(col, cast string, v any) {
		args = append(args, v)
		sets = append(sets, fmt.Sprintf("%s=$%d%s", col, len(args), cast))
	}
	if in.Summary != nil {
		if strings.TrimSpace(*in.Summary) == "" {
			writeErr(w, 400, "summary is required")
			return
		}
		add("summary", "", *in.Summary)
	}
	if in.Description != nil {
		add("description", "", *in.Description)
	}
	if in.Priority != nil {
		if !validPriorities[*in.Priority] {
			writeErr(w, 400, "invalid priority")
			return
		}
		add("priority", "::task_priority", *in.Priority)
	}
	if in.Status != nil {
		if !validStatuses[*in.Status] {
			writeErr(w, 400, "invalid status")
			return
		}
		add("status", "::task_status", *in.Status)
		if *in.Status == "done" {
			sets = append(sets, "completed_at=coalesce(completed_at, now())")
		} else {
			sets = append(sets, "completed_at=NULL")
		}
	}
	if in.StartDate != nil {
		add("start_date", "::date", nullable(in.StartDate))
	}
	if in.DueDate != nil {
		add("due_date", "::date", nullable(in.DueDate))
	}
	if in.Order != nil {
		add("position", "", *in.Order)
	}
	if len(sets) == 0 {
		s.respondTask(w, r, id, 200)
		return
	}
	args = append(args, id)
	tag, err := s.db.Exec(r.Context(), fmt.Sprintf("UPDATE tasks SET %s WHERE id=$%d::uuid", strings.Join(sets, ", "), len(args)), args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "task not found")
		return
	}
	if in.Status != nil {
		s.db.Exec(r.Context(), `INSERT INTO task_activity (task_id, user_id, kind, body) VALUES ($1::uuid, $2::uuid, 'status_change', $3)`,
			id, currentUser(r).ID, "Status changed to "+*in.Status)
	}
	s.respondTask(w, r, id, 200)
}

func (s *server) deleteTask(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(), `DELETE FROM tasks WHERE id=$1::uuid`, r.PathValue("id"))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "task not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
