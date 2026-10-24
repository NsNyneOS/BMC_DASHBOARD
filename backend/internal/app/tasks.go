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

type assignee struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Initials string `json:"initials"`
	UserType string `json:"userType"`
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
	Assignee           *string      `json:"assignee"` // names, comma separated (kept for search)
	Assignees          []assignee   `json:"assignees"`
	ReportingTo        *assignee    `json:"reportingTo"` // who reviews the task
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
	Team               string       `json:"team"`
	CreatedAt          time.Time    `json:"createdAt"`
	UpdatedAt          time.Time    `json:"updatedAt"`
	CompletedAt        *time.Time   `json:"completedAt"`
}

const taskCols = `
SELECT t.id::text, t.key, t.project, t.type::text, t.summary, t.description, t.status::text, t.priority::text,
       t.position, (SELECT string_agg(u2.name, ', ' ORDER BY u2.name) FROM task_assignees ta JOIN user_data u2 ON u2.id = ta.user_id WHERE ta.task_id = t.id), coalesce(r.username,''), to_char(t.start_date,'YYYY-MM-DD'), to_char(t.due_date,'YYYY-MM-DD'),
       t.estimate, t.story_points, t.sprint, t.labels, t.components, t.fix_version, t.parent_key, t.depends_on, t.custom_dependencies, t.source, t.client_visible, t.team,
       t.created_at, t.updated_at, t.completed_at,
       coalesce((SELECT json_agg(json_build_object('type', l.type::text, 'key', l.target_key)) FROM task_links l WHERE l.task_id = t.id), '[]'::json),
       coalesce((SELECT json_agg(json_build_object('name', f.name, 'size', f.size)) FROM task_attachments f WHERE f.task_id = t.id), '[]'::json),
       coalesce((SELECT json_agg(json_build_object('id', u2.id::text, 'name', u2.name, 'initials', u2.initials, 'userType', u2.user_type) ORDER BY u2.name) FROM task_assignees ta JOIN user_data u2 ON u2.id = ta.user_id WHERE ta.task_id = t.id), '[]'::json),
       (SELECT json_build_object('id', u3.id::text, 'name', u3.name, 'initials', u3.initials, 'userType', u3.user_type) FROM user_data u3 WHERE u3.id = t.reporting_to)`

// taskSelect builds the task query over a table or CTE (aliased t).
func taskSelect(src string) string {
	return taskCols + `
FROM ` + src + ` t
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
		var links, atts, asg, rep []byte
		if err := rows.Scan(&t.ID, &t.Key, &t.Project, &t.Type, &t.Summary, &t.Description, &t.Status, &t.Priority,
			&t.Order, &t.Assignee, &t.Reporter, &t.StartDate, &t.DueDate, &t.Estimate, &t.StoryPoints, &t.Sprint,
			&t.Labels, &t.Components, &t.FixVersion, &t.ParentKey, &t.DependsOn, &t.CustomDependencies, &t.Source, &t.ClientVisible, &t.Team, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt,
			&links, &atts, &asg, &rep); err != nil {
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
		if len(rep) > 0 {
			var r assignee
			if json.Unmarshal(rep, &r) == nil && r.ID != "" {
				t.ReportingTo = &r
			}
		}
		if json.Unmarshal(asg, &t.Assignees) != nil || t.Assignees == nil {
			t.Assignees = []assignee{}
		}
		if json.Unmarshal(atts, &t.Attachments) != nil || t.Attachments == nil {
			t.Attachments = []attachment{}
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *server) listTasks(w http.ResponseWriter, r *http.Request) {
	// Scope: external users get only their customer's visible tasks; internal users may narrow with ?customer=CODE.
	u := currentUser(r)
	q := r.URL.Query()
	if (q.Get("assignee") == "me" || q.Get("reviewer") == "me") && u.internal() && !u.can("mytasks.view") {
		writeErr(w, 403, "you do not have access to My Tasks")
		return
	}
	if q.Get("all") == "1" && u.internal() && !u.can("alltasks.view") {
		writeErr(w, 403, "you do not have access to All Tasks")
		return
	}
	where, args := taskScope(u, q.Get("customer"), 0)
	if r.URL.Query().Get("assignee") == "me" { // "My Tasks": only what is assigned to the signed-in user
		args = append(args, u.ID)
		where += " AND EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $" + itoa(len(args)) + "::uuid)"
	}
	if r.URL.Query().Get("reviewer") == "me" { // tasks the signed-in user reviews (reports to)
		args = append(args, u.ID)
		where += " AND t.reporting_to = $" + itoa(len(args)) + "::uuid"
	}
	ts, err := s.queryTasks(r.Context(), taskSelect("tasks")+" WHERE "+where+" ORDER BY t.project, t.position, t.created_at", args...)
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
	Team               string   `json:"team"`
	AssigneeIDs        []string `json:"assigneeIds"`
	ReportingToID      *string  `json:"reportingToId"`
}

var (
	validStatuses   = set("todo", "in_progress", "developing", "testing", "review", "completed", "in_review", "rework", "done")
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

// projectInScope reports whether the caller may see (and so add tasks to) the project with this code.
func (s *server) projectInScope(r *http.Request, code string) bool {
	cond, args := projectScope(currentUser(r), "", 1)
	var ok bool
	err := s.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM project_master pm JOIN customer_master c ON c.id = pm.customer_id
		WHERE pm.code = $1 AND pm.status <> 'archived' AND `+cond+`)`, append([]any{code}, args...)...).Scan(&ok)
	return err == nil && ok
}

// taskInScope reports whether the caller may see the task, so ids from other customers behave as "not found".
func (s *server) taskInScope(r *http.Request, id string) bool {
	if !uuidRe.MatchString(id) {
		return false
	}
	where, args := taskScope(currentUser(r), "", 1)
	var ok bool
	err := s.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM tasks t WHERE t.id = $1::uuid AND `+where+`)`, append([]any{id}, args...)...).Scan(&ok)
	return err == nil && ok
}

func (s *server) createTask(w http.ResponseWriter, r *http.Request) {
	if !currentUser(r).can("task.create") {
		writeErr(w, 403, "you cannot create tasks")
		return
	}
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
	u := currentUser(r)
	if in.Team == "" {
		in.Team = "nyneos"
		if !u.internal() {
			in.Team = "bmc" // "bmc" means the client side of the task for every customer
		}
	}
	if !validTeams[in.Team] {
		writeErr(w, 400, "invalid team")
		return
	}
	if !validStatuses[in.Status] || !validPriorities[in.Priority] || !validTypes[in.Type] {
		writeErr(w, 400, "invalid project, type, status or priority")
		return
	}
	if !s.projectInScope(r, in.Project) {
		writeErr(w, 400, "unknown project")
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
	if (len(in.DependsOn) > 0 || len(in.CustomDependencies) > 0) && !u.can("task.dependencies.edit") {
		writeErr(w, 403, "only NyneOS users can set dependencies")
		return
	}
	in.CustomDependencies = cleanCustom(in.CustomDependencies)
	visible := in.ClientVisible == nil || *in.ClientVisible
	if !visible && !u.can("task.visibility.manage") {
		writeErr(w, 403, "you cannot hide tasks")
		return
	}
	if msg := s.checkDependencies(r.Context(), in.Project, "", in.DependsOn); msg != "" {
		writeErr(w, 400, msg)
		return
	}
	assignees := cleanIDs(in.AssigneeIDs)
	if len(assignees) > 0 {
		if !u.can("task.assign") {
			writeErr(w, 403, "you cannot assign tasks")
			return
		}
		if msg := s.checkAssignees(r.Context(), u, assignees, in.Project, in.Team); msg != "" {
			writeErr(w, 400, msg)
			return
		}
	}
	if in.ReportingToID != nil && *in.ReportingToID == "" {
		in.ReportingToID = nil
	}
	if in.ReportingToID != nil {
		if !u.can("task.assign") {
			writeErr(w, 403, "you cannot set who a task reports to")
			return
		}
		if !s.assigneeEligible(r.Context(), u, *in.ReportingToID, in.Project) {
			writeErr(w, 400, "that person cannot be set as reporting to for this project")
			return
		}
	}
	// Counter bump, insert and read-back run as one atomic statement (one round trip).
	ts, err := s.queryTasks(r.Context(), `
WITH c AS (
  UPDATE project_master SET task_counter = task_counter + 1 WHERE code = $1 RETURNING task_counter
), n AS (
  INSERT INTO tasks (key, project, type, summary, description, status, priority, position, reporter_id, start_date, due_date,
                     estimate, story_points, sprint, labels, components, fix_version, parent_key, depends_on, custom_dependencies, client_visible, team, completed_at, reporting_to)
  SELECT $1 || '-' || c.task_counter, $1, $2::issue_type, $3, $4, $5::task_status, $6::task_priority,
         (SELECT count(*) FROM tasks WHERE status = $5::task_status), $7::uuid, $8::date, $9::date,
         $10, $11, $12, $13::text[], $14::text[], $15, $16, $17::text[], $18::text[], $19::boolean, $20::text, CASE WHEN $5 = 'done' THEN now() END, $21::uuid
  FROM c
  RETURNING *
)`+taskSelect("n"),
		in.Project, in.Type, strings.TrimSpace(in.Summary), in.Description, in.Status, in.Priority,
		currentUser(r).ID, nullable(in.StartDate), nullable(in.DueDate), nullable(in.Estimate), in.StoryPoints, in.Sprint,
		in.Labels, in.Components, in.FixVersion, nullable(in.ParentKey), in.DependsOn, in.CustomDependencies, visible, in.Team, in.ReportingToID)
	if err != nil || len(ts) == 0 {
		msg := "could not create task"
		if err != nil {
			msg = err.Error()
		}
		writeErr(w, 500, msg)
		return
	}
	if len(assignees) > 0 { // saved separately, so read the task back to include them
		if err := s.setAssignees(r.Context(), ts[0].ID, assignees); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		if again, err := s.queryTasks(r.Context(), taskSelect("tasks")+" WHERE t.id=$1::uuid", ts[0].ID); err == nil && len(again) > 0 {
			ts = again
		}
	}
	writeJSON(w, 201, ts[0])
}

func (s *server) respondTask(w http.ResponseWriter, r *http.Request, id string, code int) {
	if !s.taskInScope(r, id) {
		writeErr(w, 404, "task not found")
		return
	}
	ts, err := s.queryTasks(r.Context(), taskSelect("tasks")+" WHERE t.id=$1::uuid", id)
	if err != nil || len(ts) == 0 {
		writeErr(w, 404, "task not found")
		return
	}
	writeJSON(w, code, ts[0])
}

func (s *server) updateTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u := currentUser(r)
	if !s.taskInScope(r, id) {
		writeErr(w, 404, "task not found")
		return
	}
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
		Team               *string   `json:"team"`
		AssigneeIDs        *[]string `json:"assigneeIds"`
		ReportingToID      *string   `json:"reportingToId"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		writeErr(w, 400, "invalid body")
		return
	}
	if !u.can("task.edit") && !u.can("board.manage") {
		writeErr(w, 403, "you cannot edit tasks")
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
	if (in.DependsOn != nil || in.CustomDependencies != nil) && !u.can("task.dependencies.edit") {
		writeErr(w, 403, "you cannot set dependencies")
		return
	}
	if in.Team != nil {
		if !validTeams[*in.Team] {
			writeErr(w, 400, "invalid team")
			return
		}
		if !u.can("task.team.manage") {
			writeErr(w, 403, "you cannot change the task team")
			return
		}
		add("team", "", *in.Team)
	}
	if in.ClientVisible != nil {
		if !u.can("task.visibility.manage") {
			writeErr(w, 403, "you cannot change task visibility")
			return
		}
		add("client_visible", "", *in.ClientVisible)
	}
	// Assignees: the people must belong to the task's (possibly new) team. If only the team changes, people from the
	// other team are dropped. The change is applied below, after every validation has passed.
	var plan *struct {
		ids  []string
		team string
		set  bool
	}
	if in.AssigneeIDs != nil || in.Team != nil {
		var project, team string
		if s.db.QueryRow(r.Context(), `SELECT project, team FROM tasks WHERE id=$1::uuid`, id).Scan(&project, &team) != nil {
			writeErr(w, 404, "task not found")
			return
		}
		if in.Team != nil {
			team = *in.Team
		}
		plan = &struct {
			ids  []string
			team string
			set  bool
		}{team: team}
		if in.AssigneeIDs != nil {
			if !u.can("task.assign") {
				writeErr(w, 403, "you cannot assign tasks")
				return
			}
			plan.ids, plan.set = cleanIDs(*in.AssigneeIDs), true
			if len(plan.ids) > 0 {
				if msg := s.checkAssignees(r.Context(), u, plan.ids, project, team); msg != "" {
					writeErr(w, 400, msg)
					return
				}
			}
		}
	}
	if in.CustomDependencies != nil {
		add("custom_dependencies", "::text[]", cleanCustom(*in.CustomDependencies))
	}
	if in.DependsOn != nil {
		var project, key string
		if err := s.db.QueryRow(r.Context(), `SELECT project, key FROM tasks WHERE id=$1::uuid`, id).Scan(&project, &key); err != nil {
			writeErr(w, 404, "task not found")
			return
		}
		if msg := s.checkDependencies(r.Context(), project, key, *in.DependsOn); msg != "" {
			writeErr(w, 400, msg)
			return
		}
		add("depends_on", "::text[]", *in.DependsOn)
	}
	if in.ReportingToID != nil {
		if !u.can("task.assign") {
			writeErr(w, 403, "you cannot set who a task reports to")
			return
		}
		if *in.ReportingToID == "" {
			add("reporting_to", "::uuid", nil) // empty = nobody
		} else {
			var project string
			if s.db.QueryRow(r.Context(), `SELECT project FROM tasks WHERE id=$1::uuid`, id).Scan(&project) != nil || !s.assigneeEligible(r.Context(), u, *in.ReportingToID, project) {
				writeErr(w, 400, "that person cannot be set as reporting to for this project")
				return
			}
			add("reporting_to", "::uuid", *in.ReportingToID)
		}
	}
	if plan != nil {
		var err error
		if plan.set {
			err = s.setAssignees(r.Context(), id, plan.ids)
		} else {
			err = s.pruneAssignees(r.Context(), id, plan.team)
		}
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
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
	if !currentUser(r).can("task.delete") {
		writeErr(w, 403, "you cannot delete tasks")
		return
	}
	if !s.taskInScope(r, r.PathValue("id")) {
		writeErr(w, 404, "task not found")
		return
	}
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
	if err := s.db.QueryRow(ctx, `SELECT count(DISTINCT key) FROM tasks WHERE key = ANY($1::text[]) AND project = $2`,
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

// cleanIDs trims and de-duplicates a list of ids.
func cleanIDs(in []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, v := range in {
		if v = strings.TrimSpace(v); v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

// teamUserType is who may work on a task of the team: 'nyneos' tasks are NyneOS staff's, 'bmc' (the customer side) the customer's.
func teamUserType(team string) string {
	if team == "bmc" {
		return "external"
	}
	return "internal"
}

// checkAssignees validates a set of assignees: each must be eligible for the project and belong to the task's team.
func (s *server) checkAssignees(ctx context.Context, caller *user, ids []string, project, team string) string {
	for _, id := range ids {
		if !s.assigneeEligible(ctx, caller, id, project) {
			return "one of the selected people cannot be assigned to this project"
		}
	}
	var n int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM user_data WHERE id = ANY($1::uuid[]) AND user_type = $2`, ids, teamUserType(team)).Scan(&n); err != nil {
		return err.Error()
	}
	if n != len(ids) {
		return "assignees must belong to the task's team"
	}
	return ""
}

// setAssignees replaces a task's assignees.
func (s *server) setAssignees(ctx context.Context, taskID string, ids []string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM task_assignees WHERE task_id=$1::uuid`, taskID); err != nil {
		return err
	}
	if len(ids) > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO task_assignees (task_id, user_id) SELECT $1::uuid, unnest($2::uuid[])`, taskID, ids); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// pruneAssignees drops assignees who are not on the task's (new) team.
func (s *server) pruneAssignees(ctx context.Context, taskID, team string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM task_assignees ta USING user_data u WHERE ta.task_id=$1::uuid AND u.id = ta.user_id AND u.user_type <> $2`, taskID, teamUserType(team))
	return err
}
