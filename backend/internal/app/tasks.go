package app

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
	ID                 string       `json:"id"`
	Key                string       `json:"key"`
	Project            string       `json:"project"`
	Type               string       `json:"type"`
	Summary            string       `json:"summary"`
	Description        string       `json:"description"`
	Status             string       `json:"status"`
	Priority           string       `json:"priority"`
	Order              int          `json:"order"`
	Assignee           *string      `json:"assignee"`
	Reporter           string       `json:"reporter"`
	StartDate          *string      `json:"startDate"`
	DueDate            *string      `json:"dueDate"`
	Estimate           *string      `json:"estimate"`
	StoryPoints        *int         `json:"storyPoints"`
	Sprint             string       `json:"sprint"`
	Labels             []string     `json:"labels"`
	Components         []string     `json:"components"`
	FixVersion         string       `json:"fixVersion"`
	ParentKey          *string      `json:"parentKey"`
	DependsOn          []string     `json:"dependsOn"`
	CustomDependencies []string     `json:"customDependencies"`
	Links              []link       `json:"links"`
	Attachments        []attachment `json:"attachments"`
	Source             string       `json:"source"`
	ClientVisible      bool         `json:"clientVisible"`
	OwnerTeam          string       `json:"ownerTeam"`
	CreatedAt          time.Time    `json:"createdAt"`
	UpdatedAt          time.Time    `json:"updatedAt"`
	CompletedAt        *time.Time   `json:"completedAt"`
}

const taskCols = `
SELECT t.id::text, t.key, t.project::text, t.type::text, t.summary, t.description, t.status::text, t.priority::text,
       t.position, a.username, coalesce(r.username,''), to_char(t.start_date,'YYYY-MM-DD'), to_char(t.due_date,'YYYY-MM-DD'),
       t.estimate, t.story_points, t.sprint, t.labels, t.components, t.fix_version, t.parent_key, t.depends_on, t.custom_dependencies, t.source, t.client_visible, t.owner_team,
       t.created_at, t.updated_at, t.completed_at,
       coalesce((SELECT json_agg(json_build_object('type', l.type::text, 'key', l.target_key)) FROM task_links l WHERE l.task_id = t.id), '[]'::json),
       coalesce((SELECT json_agg(json_build_object('name', f.name, 'size', f.size)) FROM task_attachments f WHERE f.task_id = t.id), '[]'::json)`

// taskSelect builds the task query over a table or CTE (aliased t).
func taskSelect(src string) string {
	return taskCols + `
FROM ` + src + ` t
LEFT JOIN user_data a ON a.id = t.assignee_id
LEFT JOIN user_data r ON r.id = t.reporter_id`
}

// queryTasks runs a task query (see taskSelect) in a single round trip.
func (s *server) queryTasks(ctx context.Context, sql string, args ...any) ([]task, error) {
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []task{}
	for rows.Next() {
		var t task
		var links, atts []byte
		if err := rows.Scan(&t.ID, &t.Key, &t.Project, &t.Type, &t.Summary, &t.Description, &t.Status, &t.Priority,
			&t.Order, &t.Assignee, &t.Reporter, &t.StartDate, &t.DueDate, &t.Estimate, &t.StoryPoints, &t.Sprint,
			&t.Labels, &t.Components, &t.FixVersion, &t.ParentKey, &t.DependsOn, &t.CustomDependencies, &t.Source, &t.ClientVisible, &t.OwnerTeam, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt,
			&links, &atts); err != nil {
			return nil, err
		}
		if t.Labels == nil {
			t.Labels = []string{}
		}
		if t.Components == nil {
			t.Components = []string{}
		}
		if t.CustomDependencies == nil {
			t.CustomDependencies = []string{}
		}
		if t.DependsOn == nil {
			t.DependsOn = []string{}
		}
		if json.Unmarshal(links, &t.Links) != nil || t.Links == nil {
			t.Links = []link{}
		}
		if json.Unmarshal(atts, &t.Attachments) != nil || t.Attachments == nil {
			t.Attachments = []attachment{}
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *server) listTasks(w http.ResponseWriter, r *http.Request) {
	// Tasks marked NOT VISIBLE are only returned to NyneOS users.
	where := ""
	if currentUser(r).Role != "nyneos" {
		where = " WHERE t.client_visible AND t.project::text <> 'CRM'"
	}
	ts, err := s.queryTasks(r.Context(), taskSelect("tasks")+where+" ORDER BY t.project, t.position, t.created_at")
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
	Project            string   `json:"project"`
	Type               string   `json:"type"`
	Summary            string   `json:"summary"`
	Description        string   `json:"description"`
	Status             string   `json:"status"`
	Priority           string   `json:"priority"`
	StartDate          *string  `json:"startDate"`
	DueDate            *string  `json:"dueDate"`
	Estimate           *string  `json:"estimate"`
	StoryPoints        *int     `json:"storyPoints"`
	Sprint             string   `json:"sprint"`
	Labels             []string `json:"labels"`
	Components         []string `json:"components"`
	FixVersion         string   `json:"fixVersion"`
	ParentKey          *string  `json:"parentKey"`
	DependsOn          []string `json:"dependsOn"`
	CustomDependencies []string `json:"customDependencies"`
	ClientVisible      *bool    `json:"clientVisible"`
	OwnerTeam          string   `json:"ownerTeam"`
}

var (
	validProjects   = set("AML", "EKYC", "DPDP", "WEB", "CRM")
	validStatuses   = set("todo", "in_progress", "testing", "in_review", "done")
	validPriorities = set("highest", "high", "medium", "low", "lowest")
	validTeams      = set("nyneos", "bmc")
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
	if in.OwnerTeam == "" {
		in.OwnerTeam = "nyneos"
	}
	if !validTeams[in.OwnerTeam] {
		writeErr(w, 400, "invalid owner team")
		return
	}
	if !validProjects[in.Project] || !validStatuses[in.Status] || !validPriorities[in.Priority] || !validTypes[in.Type] {
		writeErr(w, 400, "invalid project, type, status or priority")
		return
	}
	if in.Project == "CRM" && currentUser(r).Role != "nyneos" {
		writeErr(w, 403, "only NyneOS users can use the CRM project")
		return
	}
	if in.Labels == nil {
		in.Labels = []string{}
	}
	if in.Components == nil {
		in.Components = []string{}
	}
	if in.DependsOn == nil {
		in.DependsOn = []string{}
	}
	if (len(in.DependsOn) > 0 || len(in.CustomDependencies) > 0) && currentUser(r).Role != "nyneos" {
		writeErr(w, 403, "only NyneOS users can set dependencies")
		return
	}
	in.CustomDependencies = cleanCustom(in.CustomDependencies)
	visible := in.ClientVisible == nil || *in.ClientVisible
	if !visible && currentUser(r).Role != "nyneos" {
		writeErr(w, 403, "only NyneOS users can hide tasks")
		return
	}
	if msg := s.checkDependencies(r.Context(), in.Project, "", in.DependsOn); msg != "" {
		writeErr(w, 400, msg)
		return
	}
	// Counter bump, insert and read-back run as one atomic statement (one round trip).
	ts, err := s.queryTasks(r.Context(), `
WITH c AS (
  UPDATE projects SET task_counter = task_counter + 1 WHERE id = $1::project_id RETURNING task_counter
), n AS (
  INSERT INTO tasks (key, project, type, summary, description, status, priority, position, reporter_id, start_date, due_date,
                     estimate, story_points, sprint, labels, components, fix_version, parent_key, depends_on, custom_dependencies, client_visible, owner_team, completed_at)
  SELECT $1 || '-' || c.task_counter, $1::project_id, $2::issue_type, $3, $4, $5::task_status, $6::task_priority,
         (SELECT count(*) FROM tasks WHERE status = $5::task_status), $7::uuid, $8::date, $9::date,
         $10, $11, $12, $13::text[], $14::text[], $15, $16, $17::text[], $18::text[], $19::boolean, $20::text, CASE WHEN $5 = 'done' THEN now() END
  FROM c
  RETURNING *
)`+taskSelect("n"),
		in.Project, in.Type, strings.TrimSpace(in.Summary), in.Description, in.Status, in.Priority,
		currentUser(r).ID, nullable(in.StartDate), nullable(in.DueDate), nullable(in.Estimate), in.StoryPoints, in.Sprint,
		in.Labels, in.Components, in.FixVersion, nullable(in.ParentKey), in.DependsOn, in.CustomDependencies, visible, in.OwnerTeam)
	if err != nil || len(ts) == 0 {
		msg := "could not create task"
		if err != nil {
			msg = err.Error()
		}
		writeErr(w, 500, msg)
		return
	}
	writeJSON(w, 201, ts[0])
}

func (s *server) respondTask(w http.ResponseWriter, r *http.Request, id string, code int) {
	ts, err := s.queryTasks(r.Context(), taskSelect("tasks")+" WHERE t.id=$1::uuid", id)
	if err != nil || len(ts) == 0 {
		writeErr(w, 404, "task not found")
		return
	}
	writeJSON(w, code, ts[0])
}

func (s *server) updateTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var in struct {
		Summary            *string   `json:"summary"`
		Description        *string   `json:"description"`
		Status             *string   `json:"status"`
		Priority           *string   `json:"priority"`
		StartDate          *string   `json:"startDate"`
		DueDate            *string   `json:"dueDate"`
		Order              *int      `json:"order"`
		DependsOn          *[]string `json:"dependsOn"`
		CustomDependencies *[]string `json:"customDependencies"`
		ClientVisible      *bool     `json:"clientVisible"`
		OwnerTeam          *string   `json:"ownerTeam"`
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
	if (in.DependsOn != nil || in.CustomDependencies != nil) && currentUser(r).Role != "nyneos" {
		writeErr(w, 403, "only NyneOS users can set dependencies")
		return
	}
	if in.OwnerTeam != nil {
		if !validTeams[*in.OwnerTeam] {
			writeErr(w, 400, "invalid owner team")
			return
		}
		if currentUser(r).Role != "nyneos" {
			writeErr(w, 403, "only NyneOS users can change the task team")
			return
		}
		add("owner_team", "", *in.OwnerTeam)
	}
	if in.ClientVisible != nil {
		if currentUser(r).Role != "nyneos" {
			writeErr(w, 403, "only NyneOS users can change task visibility")
			return
		}
		add("client_visible", "", *in.ClientVisible)
	}
	if in.CustomDependencies != nil {
		add("custom_dependencies", "::text[]", cleanCustom(*in.CustomDependencies))
	}
	if in.DependsOn != nil {
		var project, key string
		if err := s.db.QueryRow(r.Context(), `SELECT project::text, key FROM tasks WHERE id=$1::uuid`, id).Scan(&project, &key); err != nil {
			writeErr(w, 404, "task not found")
			return
		}
		if msg := s.checkDependencies(r.Context(), project, key, *in.DependsOn); msg != "" {
			writeErr(w, 400, msg)
			return
		}
		add("depends_on", "::text[]", *in.DependsOn)
	}
	if len(sets) == 0 {
		s.respondTask(w, r, id, 200)
		return
	}
	args = append(args, id)
	idArg := len(args)
	q := fmt.Sprintf("WITH u AS (UPDATE tasks SET %s WHERE id=$%d::uuid RETURNING *)", strings.Join(sets, ", "), idArg)
	if in.Status != nil {
		args = append(args, currentUser(r).ID, "Status changed to "+*in.Status)
		q += fmt.Sprintf(`, act AS (INSERT INTO task_activity (task_id, user_id, kind, body)
		        SELECT id, $%d::uuid, 'status_change', $%d FROM u)`, len(args)-1, len(args))
	}
	ts, err := s.queryTasks(r.Context(), q+taskSelect("u"), args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if len(ts) == 0 {
		writeErr(w, 404, "task not found")
		return
	}
	writeJSON(w, 200, ts[0])
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

// checkDependencies validates a depends_on list: every key must be an existing task of the
// same project, must not be the task itself and must not (transitively) depend on it.
// It returns an error message, or "" when the list is valid.
func (s *server) checkDependencies(ctx context.Context, project, selfKey string, keys []string) string {
	if len(keys) == 0 {
		return ""
	}
	var found int
	if err := s.db.QueryRow(ctx, `SELECT count(DISTINCT key) FROM tasks WHERE key = ANY($1::text[]) AND project = $2::project_id`,
		keys, project).Scan(&found); err != nil {
		return err.Error()
	}
	distinct := map[string]bool{}
	for _, k := range keys {
		if k == selfKey {
			return "a task cannot depend on itself"
		}
		distinct[k] = true
	}
	if found != len(distinct) {
		return "dependencies must be existing tasks of the same project"
	}
	if selfKey == "" {
		return ""
	}
	var cycle bool
	if err := s.db.QueryRow(ctx, `
WITH RECURSIVE chain(key) AS (
  SELECT unnest(depends_on) FROM tasks WHERE key = ANY($1::text[])
  UNION
  SELECT unnest(t.depends_on) FROM tasks t JOIN chain c ON t.key = c.key
)
SELECT EXISTS (SELECT 1 FROM chain WHERE key = $2) OR $2 = ANY($1::text[])`, keys, selfKey).Scan(&cycle); err != nil {
		return err.Error()
	}
	if cycle {
		return "dependency would create a circular chain"
	}
	return ""
}

// cleanCustom trims, de-duplicates and bounds free-text dependencies.
func cleanCustom(in []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v == "" || seen[v] {
			continue
		}
		if len(v) > 200 {
			v = v[:200]
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}
