package app

import (
	"strings"
	"testing"
)

func ptr(s string) *string { return &s }

func TestProjectScopeExternalIsLimitedToOwnCustomer(t *testing.T) {
	u := &user{ID: "u1", UserType: "external", CustomerID: ptr("c1")}
	cond, args := projectScope(u, "OTHER", 0) // a customer filter must be ignored for external users
	if !strings.Contains(cond, "pm.customer_id = $1::uuid") || !strings.Contains(cond, "NOT pm.internal_only") {
		t.Fatalf("external scope must pin the customer and hide internal-only projects: %s", cond)
	}
	if len(args) != 2 || args[0] != "c1" || args[1] != "u1" {
		t.Fatalf("unexpected args %v", args)
	}
}

func TestProjectScopeInternal(t *testing.T) {
	all := &user{UserType: "internal", Permissions: []string{"project.internal.view"}}
	if cond, args := projectScope(all, "", 0); cond != "TRUE" || len(args) != 0 {
		t.Fatalf("internal user with no filter should see everything, got %q %v", cond, args)
	}
	cond, args := projectScope(all, "acme", 3)
	if cond != "c.code = $4" || len(args) != 1 || args[0] != "ACME" {
		t.Fatalf("customer filter should be upper-cased and numbered after the base: %q %v", cond, args)
	}
	if cond, _ := projectScope(all, "all", 0); cond != "c.customer_type = 'client' AND c.status = 'active'" {
		t.Fatalf("'all' is the customers' combined view without the owner's internal projects, got %q", cond)
	}
	if cond, args := projectScope(all, "nyneos", 0); cond != "c.code = $1" || args[0] != "NYNEOS" {
		t.Fatalf("the owner's code selects its internal projects, got %q %v", cond, args)
	}
	noInternal := &user{UserType: "internal"}
	if cond, _ := projectScope(noInternal, "", 0); !strings.Contains(cond, "NOT pm.internal_only") {
		t.Fatalf("internal users without project.internal.view must not see internal-only projects: %s", cond)
	}
}

func TestTaskScopeHidesNotVisibleTasksFromExternalUsersOnly(t *testing.T) {
	ext, _ := taskScope(&user{UserType: "external", CustomerID: ptr("c1")}, "", 0)
	if !strings.HasSuffix(ext, "AND t.client_visible") {
		t.Fatalf("external task scope must require client_visible: %s", ext)
	}
	in, _ := taskScope(&user{UserType: "internal"}, "", 0)
	if strings.Contains(in, "client_visible") {
		t.Fatalf("internal users see not-visible tasks: %s", in)
	}
}

func TestCanAndInitials(t *testing.T) {
	u := &user{Permissions: []string{"task.create"}}
	if !u.can("task.create") || u.can("task.delete") {
		t.Fatal("can() should match exact permission codes")
	}
	if initialsOf("anita rao kumar") != "AR" || initialsOf("  ") != "?" {
		t.Fatal("unexpected initials")
	}
}

func TestExternalPermissionsAreRestricted(t *testing.T) {
	final, bad := externalPermissions([]string{"task.create", "board.view"})
	if bad != "" || len(final) != 4 || final[0] != "dashboard.view" {
		t.Fatalf("dashboard views are always included, got %v (bad %q)", final, bad)
	}
	for _, forbidden := range []string{"customer.view", "customer.manage", "user.view", "user.manage", "role.manage", "project.internal.view", "project.manage"} {
		if _, bad := externalPermissions([]string{forbidden}); bad != forbidden {
			t.Fatalf("%s must not be grantable to customer roles", forbidden)
		}
	}
	if final, _ := externalPermissions([]string{"task.create", "task.create"}); len(final) != 3 {
		t.Fatalf("duplicates should be collapsed, got %v", final)
	}
}

// Customer codes use the same generator (initials of the name, numbered when taken).
func TestProjectCodeBase(t *testing.T) {
	cases := map[string]string{
		"Loan Origination":    "LO",
		"Website":             "WEBS",
		"AML":                 "AML",
		"core banking system": "CBS",
		"  ":                  "PP",
		"9 Lives":             "LP",
		"a b c d e f g":       "ABCDE",
	}
	for in, want := range cases {
		if got := projectCodeBase(in); got != want || !codeRe.MatchString(got) {
			t.Errorf("projectCodeBase(%q) = %q, want %q", in, got, want)
		}
	}
}
