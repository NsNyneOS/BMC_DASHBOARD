package app

import (
	"net/http"
	"strings"
	"time"
)

type customerOut struct {
	ID           string    `json:"id"`
	Code         string    `json:"code"`
	Name         string    `json:"name"`
	ShortName    string    `json:"shortName"`
	Type         string    `json:"type"`
	LogoURL      string    `json:"logoUrl"`
	ContactName  string    `json:"contactName"`
	ContactEmail string    `json:"contactEmail"`
	ContactPhone string    `json:"contactPhone"`
	Address      string    `json:"address"`
	Status       string    `json:"status"`
	ProjectCount int       `json:"projectCount"`
	UserCount    int       `json:"userCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

const customerCols = `SELECT c.id::text, c.code, c.name, coalesce(c.short_name,''), c.customer_type, coalesce(c.logo_url,''),
       coalesce(c.contact_name,''), coalesce(c.contact_email,''), coalesce(c.contact_phone,''),
       coalesce(c.address,''), c.status, c.created_at,
       (SELECT count(*) FROM project_master pm WHERE pm.customer_id = c.id),
       (SELECT count(*) FROM user_data u WHERE u.customer_id = c.id)
FROM customer_master c`

func scanCustomer(row interface{ Scan(...any) error }) (customerOut, error) {
	var c customerOut
	err := row.Scan(&c.ID, &c.Code, &c.Name, &c.ShortName, &c.Type, &c.LogoURL, &c.ContactName,
		&c.ContactEmail, &c.ContactPhone, &c.Address, &c.Status, &c.CreatedAt, &c.ProjectCount, &c.UserCount)
	return c, err
}

// listCustomers returns the customers NyneOS serves (customer.view, internal users only).
// NyneOS itself is the owner, not a customer, so its record is never listed here (see getOwner).
func (s *server) listCustomers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), customerCols+` WHERE c.customer_type = 'client' ORDER BY c.name`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []customerOut{}
	for rows.Next() {
		c, err := scanCustomer(rows)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, c)
	}
	writeJSON(w, 200, out)
}

type customerInput struct {
	Code         *string `json:"code"`
	Name         *string `json:"name"`
	ShortName    *string `json:"shortName"`
	LogoURL      *string `json:"logoUrl"`
	ContactName  *string `json:"contactName"`
	ContactEmail *string `json:"contactEmail"`
	ContactPhone *string `json:"contactPhone"`
	Address      *string `json:"address"`
	Status       *string `json:"status"`
}

func (s *server) createCustomer(w http.ResponseWriter, r *http.Request) {
	var in customerInput
	if !readJSON(r, &in) || in.Name == nil || strings.TrimSpace(*in.Name) == "" {
		writeErr(w, 400, "name is required")
		return
	}
	name := strings.TrimSpace(*in.Name)
	code := ""
	if in.Code != nil {
		code = strings.ToUpper(strings.TrimSpace(*in.Code))
	}
	if code != "" && !codeRe.MatchString(code) {
		writeErr(w, 400, "code must be 2-10 characters: A-Z and 0-9, starting with a letter")
		return
	}
	if code == "" { // no code given: generate a unique one from the name (initials, numbered if taken)
		var err error
		if code, err = s.uniqueCode(r.Context(), "customer_master", name); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
	}
	val := func(p *string) string {
		if p == nil {
			return ""
		}
		return strings.TrimSpace(*p)
	}
	var id string
	err := s.db.QueryRow(r.Context(), `
		INSERT INTO customer_master (code, name, short_name, customer_type, logo_url, contact_name, contact_email, contact_phone, address)
		VALUES ($1, $2, NULLIF($3,''), 'client', NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,''))
		RETURNING id::text`, code, name, val(in.ShortName), val(in.LogoURL), val(in.ContactName),
		val(in.ContactEmail), val(in.ContactPhone), val(in.Address)).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") {
			writeErr(w, 409, "a customer with this code already exists")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	c, err := scanCustomer(s.db.QueryRow(r.Context(), customerCols+` WHERE c.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, c)
}

func (s *server) updateCustomer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidRe.MatchString(id) {
		writeErr(w, 404, "customer not found")
		return
	}
	var in customerInput
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	sets, args := []string{}, []any{}
	add := func(col string, v *string, nullIfEmpty bool) {
		if v == nil {
			return
		}
		t := strings.TrimSpace(*v)
		args = append(args, t)
		if nullIfEmpty {
			sets = append(sets, col+"=NULLIF($"+itoa(len(args))+",'')")
		} else {
			sets = append(sets, col+"=$"+itoa(len(args)))
		}
	}
	if in.Name != nil && strings.TrimSpace(*in.Name) == "" {
		writeErr(w, 400, "name is required")
		return
	}
	if in.Status != nil && *in.Status != "active" && *in.Status != "inactive" {
		writeErr(w, 400, "invalid status")
		return
	}
	add("name", in.Name, false)
	add("short_name", in.ShortName, true)
	add("logo_url", in.LogoURL, true)
	add("contact_name", in.ContactName, true)
	add("contact_email", in.ContactEmail, true)
	add("contact_phone", in.ContactPhone, true)
	add("address", in.Address, true)
	add("status", in.Status, false)
	if len(sets) > 0 {
		args = append(args, id)
		tag, err := s.db.Exec(r.Context(), `UPDATE customer_master SET `+strings.Join(sets, ", ")+` WHERE customer_type = 'client' AND id=$`+itoa(len(args))+`::uuid`, args...)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		if tag.RowsAffected() == 0 {
			writeErr(w, 404, "customer not found")
			return
		}
		clearUserCache() // customer status / branding are part of the cached user
	}
	c, err := scanCustomer(s.db.QueryRow(r.Context(), customerCols+` WHERE c.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 404, "customer not found")
		return
	}
	writeJSON(w, 200, c)
}

// getOwner returns the owner organisation (NyneOS). It owns the internal-only projects, e.g. CRM.
func (s *server) getOwner(w http.ResponseWriter, r *http.Request) {
	c, err := scanCustomer(s.db.QueryRow(r.Context(), customerCols+` WHERE c.customer_type = 'internal' LIMIT 1`))
	if err != nil {
		writeErr(w, 404, "owner not found")
		return
	}
	writeJSON(w, 200, c)
}
