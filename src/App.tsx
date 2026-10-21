import { useMemo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import DependencyPicker, { dependents } from "./components/DependencyPicker";
import VisibilityToggle from "./components/VisibilityToggle";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  parseISO,
  format,
  isBefore,
  startOfDay,
  subDays,
} from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Palette,
  Plus,
  Search,
  Sun,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useTaskStore } from "./store/useTaskStore";
import { useAuthStore } from "./store/useAuthStore";
import type { ProjectMeta } from "./api/client";
import Login from "./components/Login";
import { selectFiltered } from "./store/selectors";
import { useTheme, type Mode, type Theme } from "./theme/ThemeProvider";
import { monthGrid, toISO } from "./utils/date";
import type { ProjectId, Status, Task } from "./types/task";
import TaskModal from "./components/TaskModal";
import ModernSelect from "./components/ModernSelect";
import ConfirmDialog from "./components/ConfirmDialog";
import bombayMercantileLogo from "../assets/bombay_mercantile_bank_logo.png";
import nyneosLogo from "../assets/nyneos_logo.png";
const projects: ProjectId[] = ["AML", "EKYC", "DPDP", "WEB"],
  statuses: Status[] = ["todo", "in_progress", "testing", "in_review", "done"];
const statusName: Record<Status, string> = {
  todo: "New",
  in_progress: "In Progress",
  testing: "Testing/Review",
  in_review: "Deploying",
  done: "Completed",
};
const projectName = (p: ProjectId) => (p === "WEB" ? "Website" : p);
const color = (p: ProjectId) => `var(--${p.toLowerCase()})`;
const due = (x: string | null) =>
  x ? format(new Date(`${x}T12:00:00`), "MMM d") : "No date";
const isOver = (t: Task) =>
  !!t.dueDate &&
  t.status !== "done" &&
  isBefore(new Date(t.dueDate), startOfDay(new Date()));
function Logos({ footer = false }: { footer?: boolean }) {
  return (
    <div className={footer ? "logos footerLogos" : "logos"}>
      <span>
        <img
          src={bombayMercantileLogo}
          alt="Bombay Mercantile Co-operative Bank"
        />
      </span>
      <i />
      <span className="nyneos">
        <img src={nyneosLogo} alt="NyneOS Technologies" />
      </span>
    </div>
  );
}
function ThemeMenu({ close }: { close: () => void }) {
  const { theme, mode, setMode, setTheme } = useTheme();
  return (
    <div className="themeMenu">
      <h4>Appearance</h4>
      <div className="segments" role="radiogroup">
        {(
          [
            ["light", Sun],
            ["dark", Moon],
            ["system", Monitor],
          ] as const
        ).map(([m, I]) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => setMode(m as Mode)}
          >
            <I />
            {m}
          </button>
        ))}
      </div>
      <h4>Colour theme</h4>
      {(["orange-red", "orange-green"] as Theme[]).map((t) => (
        <button
          className={`swatch ${theme === t ? "selected" : ""}`}
          key={t}
          onClick={() => {
            setTheme(t);
            close();
          }}
        >
          <span>
            <i />
            <i />
          </span>
          {t === "orange-red" ? "Orange · Red" : "Orange · Green"}
          {theme === t && <Check />}
        </button>
      ))}
    </div>
  );
}
function Header({ create }: { create: () => void }) {
  const filters = useTaskStore((s) => s.filters),
    setFilters = useTaskStore((s) => s.setFilters),
    user = useAuthStore((s) => s.user),
    logout = useAuthStore((s) => s.logout);
  const { toggleMode } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false),
    [activePage, setActivePage] = useState<"board" | "calendar">(
      user?.canManageBoard ? "board" : "calendar",
    );
  return (
    <header className="topbar">
      <div className="headerInner">
        <Logos />
        {user?.role !== "bmc" && (
          <nav className="ranges">
            {(["board", "calendar"] as const)
              .filter((page) => page !== "board" || user?.canManageBoard)
              .map((page) => (
                <button
                  className={activePage === page ? "active" : ""}
                  onClick={() => {
                    setActivePage(page);
                    document
                      .getElementById(page)
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  key={page}
                >
                  {page === "board" ? "Board" : "Calendar"}
                </button>
              ))}
          </nav>
        )}
        <div className="actions">
          <label className="search">
            <Search />
            <input
              aria-label="Search tasks"
              placeholder="Search task or key…"
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </label>
          <button
            className="icon"
            onClick={toggleMode}
            aria-label="Toggle mode"
          >
            <Sun />
          </button>
          <div className="relative">
            <button
              className="icon"
              onClick={() => setThemeOpen(!themeOpen)}
              aria-label="Choose theme"
            >
              <Palette />
            </button>
            {themeOpen && <ThemeMenu close={() => setThemeOpen(false)} />}
          </div>
          {user && (
            <span className="userChip" title={user.name}>
              <b>{user.initials}</b>
              {user.name}
            </span>
          )}
          <button className="icon" onClick={logout} aria-label="Sign out">
            <LogOut />
          </button>
          {user?.role !== "bmc" && (
            <button
              className="create"
              onClick={create}
              aria-label="Create task"
            >
              <Plus />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
/* My Tasks widget (disabled)
function MyTasks({ create }: { create: () => void }) { const tasks = useTaskStore(useShallow(selectFiltered)), select = useTaskStore(s => s.selectTask), [tab, setTab] = useState<'today' | 'tomorrow'>('today'), [kind, setKind] = useState('ongoing'); const date = toISO(addDays(new Date(), tab === 'today' ? 0 : 1)); const list = tasks.filter(t => (t.dueDate === date || tab === 'today') && (kind === 'all' || kind === 'done' ? t.status === 'done' : kind === 'overdue' ? isOver(t) : t.status !== 'done')).slice(0, 6); return <section className="card myTasks"><div className="cardHead"><h2>My Tasks</h2><button className="icon" onClick={create}><Plus /></button></div><div className="segments tiny"><button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>Today</button><button className={tab === 'tomorrow' ? 'active' : ''} onClick={() => setTab('tomorrow')}>Tomorrow</button></div><div className="taskSelect taskSelectModern"><b>{list.length}</b><ModernSelect ariaLabel="Task view" value={kind} options={[{ value: 'ongoing', label: 'On Going Tasks' }, { value: 'done', label: 'Completed' }, { value: 'overdue', label: 'Overdue' }, { value: 'all', label: 'All' }]} onChange={setKind} /></div><div className="taskList">{list.map((t, i) => <article className={`miniTask tint${i % 4}`} key={t.id} onClick={() => select(t.id)}><h3>{t.summary}</h3><p>{t.description}</p><div><span className={isOver(t) ? 'chip overdue' : 'chip'}><Clock3 />{due(t.dueDate)}</span><span className="chip">{t.priority}</span></div></article>)}</div></section> }
*/
type SummaryAlert = {
  id: string;
  message: string;
  severity: string;
  taskKeys: string[];
};
type SummaryView = { project: ProjectId; view: "activities" | "alerts" } | null;
function buildSummary(tasks: Task[], meta: ProjectMeta[]) {
  return projects.map((p) => {
    const list = tasks.filter((t) => t.project === p),
      done = list.filter((t) => t.status === "done").length,
      overdue = list.filter(isOver),
      m = meta.find((x) => x.id === p),
      dates = list
        .flatMap((t) => [t.startDate, t.dueDate])
        .filter((d): d is string => !!d)
        .sort(),
      alerts: SummaryAlert[] = [
        ...(overdue.length
          ? [
              {
                id: "overdue-" + p,
                message: `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}`,
                severity: "critical",
                taskKeys: overdue.map((t) => t.key),
              },
            ]
          : []),
        ...(m?.alerts ?? []).map((a) => ({
          id: a.id,
          message: a.message,
          severity: a.severity,
          taskKeys: a.taskKey ? [a.taskKey] : [],
        })),
      ];
    const started = list.filter((t) => t.status !== "todo").length;
    return {
      project: p,
      list,
      done,
      started,
      startedPercent: list.length
        ? Math.round((started / list.length) * 100)
        : 0,
      percent: list.length ? Math.round((done / list.length) * 100) : 0,
      start: m?.startDate || dates[0] || null,
      end: m?.endDate || dates.at(-1) || null,
      alerts,
    };
  });
}
function ProjectSummary() {
  const tasks = useTaskStore((s) => s.tasks),
    meta = useTaskStore((s) => s.projects),
    select = useTaskStore((s) => s.selectTask),
    [open, setOpen] = useState<SummaryView>(null),
    setDates = useTaskStore((s) => s.setProjectDates),
    [draft, setDraft] = useState({ start: "", end: "" }),
    [saving, setSaving] = useState(false),
    [dateError, setDateError] = useState(""),
    rows = useMemo(() => buildSummary(tasks, meta), [tasks, meta]),
    current = open ? rows.find((r) => r.project === open.project) : null,
    openTask = (key: string) => {
      const t = tasks.find((x) => x.key === key);
      if (t) {
        setOpen(null);
        select(t.id);
      }
    };
  useEffect(() => {
    const m = open ? meta.find((x) => x.id === open.project) : null;
    setDraft({ start: m?.startDate || "", end: m?.endDate || "" });
    setDateError("");
  }, [open, meta]);
  const saveDates = async () => {
    if (!open) return;
    if (draft.start && draft.end && draft.end < draft.start) {
      setDateError("End date must be on or after start date");
      return;
    }
    setSaving(true);
    setDateError("");
    try {
      await setDates(open.project, draft.start, draft.end);
    } catch (e) {
      setDateError(e instanceof Error ? e.message : "Could not save dates");
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <section className="summaryGrid" aria-label="Project summary">
        {rows.map((r) => (
          <div
            className="summaryBar"
            key={r.project}
            style={{ "--bar": color(r.project) } as React.CSSProperties}
          >
            <button
              className="summaryMain"
              onClick={() =>
                setOpen({ project: r.project, view: "activities" })
              }
              aria-label={`${projectName(r.project)} activities`}
            >
              <div className="summaryTop">
                <strong>
                  <i />
                  {projectName(r.project)}
                </strong>
                <span className="summaryDates">
                  <CalendarDays />
                  {r.start ? due(r.start) : "No date"}
                  {r.end && r.end !== r.start ? ` – ${due(r.end)}` : ""}
                </span>
              </div>
              <div className="summaryTrack">
                <i style={{ width: `${r.percent}%` }} />
              </div>
              <div className="summaryFoot">
                <span>
                  <b>{r.percent}%</b> complete
                </span>
                <span>
                  {r.done} of {r.list.length} done
                </span>
              </div>
              <div className="summaryTrack started">
                <i style={{ width: `${r.startedPercent}%` }} />
              </div>
              <div className="summaryFoot">
                <span>
                  <b>{r.startedPercent}%</b> in progress
                </span>
                <span>
                  {r.started} of {r.list.length} started
                </span>
              </div>
            </button>
            {r.alerts.length > 0 ? (
              <button
                className="alertBadge"
                onClick={() => setOpen({ project: r.project, view: "alerts" })}
                aria-label={`${r.alerts.length} alerts for ${projectName(r.project)}`}
              >
                <AlertTriangle />
                {r.alerts.length} alert{r.alerts.length > 1 ? "s" : ""}
              </button>
            ) : (
              <span className="onTrack">On track</span>
            )}
          </div>
        ))}
      </section>
      {open && current && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div
            className="modal summaryModal"
            role="dialog"
            aria-modal="true"
            aria-label={`${projectName(open.project)} ${open.view}`}
          >
            <header>
              <div>
                <h2>
                  {projectName(open.project)} ·{" "}
                  {open.view === "alerts" ? "Alerts" : "Activities"}
                </h2>
                <span className="eyebrow">
                  {current.percent}% complete ·{" "}
                  {current.start ? due(current.start) : "No date"}
                  {current.end && current.end !== current.start
                    ? ` – ${due(current.end)}`
                    : ""}
                </span>
              </div>
              <button
                className="icon"
                onClick={() => setOpen(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </header>
            <div className="summaryBody">
            
              {open.view === "alerts" ? (
                current.alerts.length ? (
                  current.alerts.map((a) => (
                    <div className={`alertItem ${a.severity}`} key={a.id}>
                      <h3>
                        <AlertTriangle />
                        {a.message}
                      </h3>
                      {a.taskKeys.map((k) => {
                        const t = tasks.find((x) => x.key === k);
                        return t ? (
                          <button
                            className="activityRow"
                            key={k}
                            onClick={() => openTask(k)}
                          >
                            <span>{t.summary}</span>
                            <span className={isOver(t) ? "overdue" : ""}>
                              <Clock3 />
                              {due(t.dueDate)}
                            </span>
                          </button>
                        ) : null;
                      })}
                    </div>
                  ))
                ) : (
                  <p className="eyebrow">No alerts for this project.</p>
                )
              ) : (
                statuses.map((st) => {
                  const items = current.list
                    .filter((t) => t.status === st)
                    .sort((a, b) => a.order - b.order);
                  return (
                    <div className="activityGroup" key={st}>
                      <h3>
                        {statusName[st]}
                        <span>{items.length}</span>
                      </h3>
                      {items.length ? (
                        items.map((t) => (
                          <button
                            className="activityRow"
                            key={t.id}
                            onClick={() => openTask(t.key)}
                          >
                            <span>{t.summary}</span>
                            <span className={isOver(t) ? "overdue" : ""}>
                              <Clock3 />
                              {due(t.dueDate)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="eyebrow">No activities</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function Overview({ tasks }: { tasks: Task[] }) {
  const total = tasks.length,
    done = tasks.filter((t) => t.status === "done").length,
    progress = tasks.filter(
      (t) =>
        t.status === "in_progress" ||
        t.status === "testing" ||
        t.status === "in_review",
    ).length;
  const r = 65,
    c = 2 * Math.PI * r;
  return (
    <section className="card">
      <div className="cardHead">
        <div>
          <h2>Projects Overview</h2>
        </div>
      </div>
      <div className="donutWrap">
        <svg viewBox="0 0 180 180">
          <circle className="donutTrack" cx="90" cy="90" r={r} />
          <circle
            className="donutProgress"
            cx="90"
            cy="90"
            r={r}
            strokeDasharray={`${total ? (progress / total) * c : 0} ${c}`}
          />
          <circle
            className="donutDone"
            cx="90"
            cy="90"
            r={r}
            strokeDasharray={`${total ? (done / total) * c : 0} ${c}`}
            strokeDashoffset={-(total ? (progress / total) * c : 0)}
          />
        </svg>
        <div>
          <strong>{total}</strong>
          <span>Total tasks</span>
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="orange" />
          In progress <b>{progress}</b>
        </span>
        <span>
          <i className="green" />
          Completed <b>{done}</b>
        </span>
        <span>
          <i />
          New <b>{total - done - progress}</b>
        </span>
      </div>
    </section>
  );
}
/* Created vs Completed widget (disabled)
function Trend({ tasks }: { tasks: Task[] }) { const data = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = addMonths(new Date(2026, 8, 1), i); return { label: format(d, 'MMM'), created: tasks.filter(t => format(t.startDate ? parseISO(t.startDate) : new Date(t.createdAt), 'yyyy-MM') === format(d, 'yyyy-MM')).length, done: tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM') === format(d, 'yyyy-MM')).length } }), [tasks]); const max = Math.max(1, ...data.flatMap(x => [x.created, x.done])), pts = (k: 'created' | 'done') => data.map((x, i) => `${24 + i * 66},${184 - x[k] / max * 140}`).join(' '); return <section className="card"><div className="cardHead"><div><h2>Created vs Completed</h2></div></div><svg className="trend" viewBox="0 0 380 220">{[44, 79, 114, 149, 184].map(y => <line key={y} x1="24" x2="360" y1={y} y2={y} />)}<polyline className="createdLine" points={pts('created')} /><polyline className="doneLine" points={pts('done')} />{data.map((x, i) => <g key={x.label}><circle cx={24 + i * 66} cy={184 - x.created / max * 140} r="4" /><text x={24 + i * 66} y="210">{x.label}</text><title>{x.label}: {x.created} created, {x.done} completed</title></g>)}</svg><div className="chartLegend"><span><i className="orange" />Created</span><span><i className="green" />Completed</span></div></section> }
*/
function Progress({ tasks }: { tasks: Task[] }) {
  return (
    <section className="card progress" id="reports">
      <div className="cardHead">
        <div>
          <h2>Project Progress</h2>
        </div>
        <TrendingUp />
      </div>
      <div className="progressList">
        {projects.map((p) => {
          const a = tasks.filter((t) => t.project === p),
            d = a.filter((t) => t.status === "done").length,
            ip = a.filter((t) =>
              ["in_progress", "testing", "in_review"].includes(t.status),
            ).length,
            pct = (n: number) => `${a.length ? (n / a.length) * 100 : 0}%`;
          return (
            <div className="progressRow" key={p}>
              <strong>{projectName(p)}</strong>
              <div className="track">
                <i
                  className="seg done"
                  style={{ width: pct(d), background: color(p) }}
                />
                <i
                  className="seg active"
                  style={{ width: pct(ip), background: color(p) }}
                />
              </div>
              <span>
                <b>{ip}</b> In Progress · <b>{d}</b> Completed
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
const BOARD_PAGE_SIZE = 4;
function DropColumn({
  status,
  index,
  children,
}: {
  status: Status;
  index: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={"column status" + index + (isOver ? " dropActive" : "")}
    >
      {children}
    </div>
  );
}
function SortCard({
  task,
  onRequestMove,
  onRequestDelete,
}: {
  task: Task;
  onRequestMove: (task: Task, status: Status) => void;
  onRequestDelete: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: task.id }),
    select = useTaskStore((s) => s.selectTask);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="kanbanCard"
      onClick={() => select(task.id)}
      {...attributes}
      {...listeners}
    >
      <div className="key">
        <span
          className="projectPill"
          style={{
            color: color(task.project),
            borderColor: color(task.project),
          }}
        >
          <i />
          {projectName(task.project)}
        </span>
        <button
          className="cardDelete"
          aria-label={"Delete " + task.key}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete(task);
          }}
        >
          <Trash2 />
        </button>
      </div>
      <h3>{task.summary}</h3>
      <div className="cardMeta">
        <span className={isOver(task) ? "overdue" : ""}>
          <Clock3 />
          {due(task.dueDate)}
        </span>
      </div>
      <div className="cardBottom" onClick={(event) => event.stopPropagation()}>
        <ModernSelect
          className="cardStatusSelect"
          ariaLabel={"Change status for " + task.key}
          value={task.status}
          options={statuses.map((status) => ({
            value: status,
            label: statusName[status],
          }))}
          onChange={(value) => {
            const next = value as Status;
            if (next !== task.status) onRequestMove(task, next);
          }}
        />
      </div>
    </article>
  );
}
function Board({ create }: { create: (s: Status) => void }) {
  const tasks = useTaskStore(useShallow(selectFiltered)),
    move = useTaskStore((s) => s.moveTask),
    remove = useTaskStore((s) => s.deleteTask),
    filters = useTaskStore((s) => s.filters),
    setFilters = useTaskStore((s) => s.setFilters),
    [pending, setPending] = useState<{ task: Task; status: Status } | null>(
      null,
    ),
    [pendingDelete, setPendingDelete] = useState<Task | null>(null),
    [pages, setPages] = useState<Partial<Record<Status, number>>>({}),
    sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      }),
    );
  const requestMove = (task: Task, status: Status) =>
    setPending({ task, status });
  const end = (e: DragEndEvent) => {
    const id = String(e.active.id),
      over = String(e.over?.id || ""),
      task = tasks.find((item) => item.id === id),
      target = statuses.includes(over as Status)
        ? (over as Status)
        : tasks.find((item) => item.id === over)?.status;
    if (task && target && target !== task.status) requestMove(task, target);
  };
  return (
    <section className="section" id="board">
      <div className="sectionHead">
        <div>
          <h2>Board</h2>
        </div>
        <div className="boardFilters">
          <ModernSelect
            className="boardFilter"
            ariaLabel="Filter by project"
            value={filters.project}
            options={[
              { value: "all", label: "All projects" },
              ...projects.map((project) => ({
                value: project,
                label: projectName(project),
              })),
            ]}
            onChange={(value) =>
              setFilters({ project: value as ProjectId | "all" })
            }
          />
        </div>
      </div>
      <DndContext sensors={sensors} onDragEnd={end}>
        <div className="board">
          {statuses.map((status, index) => {
            const list = tasks
                .filter((task) => task.status === status)
                .sort((a, b) => a.order - b.order),
              pageCount = Math.max(1, Math.ceil(list.length / BOARD_PAGE_SIZE)),
              page = Math.min(pages[status] ?? 0, pageCount - 1),
              visible = list.slice(
                page * BOARD_PAGE_SIZE,
                (page + 1) * BOARD_PAGE_SIZE,
              ),
              go = (n: number) => setPages((p) => ({ ...p, [status]: n }));
            return (
              <DropColumn key={status} status={status} index={index}>
                <div className="columnHead">
                  <i />
                  <strong>{statusName[status]}</strong>
                  <span>{list.length}</span>
                  <button className="icon small" onClick={() => create(status)}>
                    <Plus />
                  </button>
                </div>
                <SortableContext
                  items={visible.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="columnList" data-status={status}>
                    {visible.map((task) => (
                      <SortCard
                        key={task.id}
                        task={task}
                        onRequestMove={requestMove}
                        onRequestDelete={setPendingDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
                {pageCount > 1 && (
                  <div className="columnPager">
                    <button
                      className="icon small"
                      disabled={page === 0}
                      onClick={() => go(page - 1)}
                      aria-label={"Previous page, " + statusName[status]}
                    >
                      <ChevronLeft />
                    </button>
                    <span>
                      {page + 1} / {pageCount}
                    </span>
                    <button
                      className="icon small"
                      disabled={page >= pageCount - 1}
                      onClick={() => go(page + 1)}
                      aria-label={"Next page, " + statusName[status]}
                    >
                      <ChevronRight />
                    </button>
                  </div>
                )}
              </DropColumn>
            );
          })}
        </div>
      </DndContext>
      <ConfirmDialog
        open={!!pending}
        title="Move this task?"
        confirmLabel="Yes, move task"
        message={
          pending
            ? pending.task.key +
              " will move from " +
              statusName[pending.task.status] +
              " to " +
              statusName[pending.status] +
              ". Are you sure?"
            : ""
        }
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) move(pending.task.id, pending.status);
          setPending(null);
        }}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this task?"
        message={
          pendingDelete
            ? pendingDelete.key + " will be permanently removed. Are you sure?"
            : ""
        }
        confirmLabel="Yes, delete task"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </section>
  );
}
type DepLink = {
  id: string;
  from: string;
  to: string;
  d: string;
  ax: number;
  ay: number;
  lx: number;
  ly: number;
  late: boolean;
  color: string;
};
const hasDependency = (t: Task) =>
  (t.dependsOn?.length ?? 0) + (t.customDependencies?.length ?? 0) > 0;
const dependencyTitle = (t: Task) =>
  hasDependency(t)
    ? " · Depends on: " +
      [...(t.dependsOn ?? []), ...(t.customDependencies ?? [])].join(", ")
    : "";

function Calendar({
  create,
  viewOnly = false,
}: {
  create: (s: Status, d?: string) => void;
  viewOnly?: boolean;
}) {
  const tasks = useTaskStore(useShallow(selectFiltered)),
    select = useTaskStore((s) => s.selectTask),
    [view, setView] = useState<"timeline" | "month" | "week">("timeline"),
    [anchor, setAnchor] = useState(new Date()),
    cardRef = useRef<HTMLDivElement>(null),
    [collapsed, setCollapsed] = useState<Record<string, boolean>>({}),
    [links, setLinks] = useState<DepLink[]>([]),
    [linkSize, setLinkSize] = useState({ w: 0, h: 0 }),
    [hoverKey, setHoverKey] = useState<string | null>(null),
    // Visible lane area (inside the timeline): connectors are clipped so they never draw over the sticky
    // task-name column or the date header.
    [clip, setClip] = useState({ x: 245, y: 0 });
  // Measure the rendered bars and draw an elbow connector from every task to the tasks it depends on.
  useLayoutEffect(() => {
    const box = cardRef.current?.querySelector<HTMLElement>(".timeline");
    if (view !== "timeline" || !box) {
      setLinks([]);
      return;
    }
    const measure = () => {
      const origin = box.getBoundingClientRect(),
        bars = new Map<string, HTMLElement>();
      box
        .querySelectorAll<HTMLElement>(".bar[data-key]")
        .forEach((el) => bars.set(el.dataset.key!, el));
      const next: DepLink[] = [];
      for (const t of tasks) {
        const target = bars.get(t.key);
        if (!target || !t.dependsOn?.length) continue;
        const tr = target.getBoundingClientRect();
        for (const depKey of t.dependsOn) {
          const src = bars.get(depKey),
            pred = tasks.find((x) => x.key === depKey);
          if (!src || !pred) continue;
          // The line runs from the task that must finish first (right edge) to the dependent task (left edge).
          const sr = src.getBoundingClientRect(),
            x1 = sr.right - origin.left,
            y1 = sr.top + sr.height / 2 - origin.top,
            x2 = tr.left - origin.left,
            y2 = tr.top + tr.height / 2 - origin.top,
            gap = 14,
            ym = (y1 + y2) / 2,
            roomy = x2 >= x1 + gap * 2,
            lo = Math.min(y1, y2),
            hi = Math.max(y1, y2),
            // Pick a vertical run that does not cut through any other bar between the two rows.
            blocked = (x: number) =>
              [...bars].some(([k, el]) => {
                if (k === depKey || k === t.key) return false;
                const r = el.getBoundingClientRect();
                return (
                  x > r.left - origin.left - 3 &&
                  x < r.right - origin.left + 3 &&
                  r.bottom - origin.top > lo &&
                  r.top - origin.top < hi
                );
              }),
            vx = roomy
              ? ([x1 + gap, x2 - gap, (x1 + x2) / 2].find((x) => !blocked(x)) ?? x1 + gap)
              : 0,
            d = roomy
              ? `M${x1} ${y1} H${vx} V${y2} H${x2 - 1}`
              : `M${x1} ${y1} H${x1 + gap} V${ym} H${x2 - gap} V${y2} H${x2 - 1}`,
            lx = roomy ? (vx + x2) / 2 : (x2 - gap + x1 + gap) / 2,
            ly = (roomy ? y2 : ym) - 5,
            // A predecessor that is not done and ends on/after this task's start is blocking it.
            late =
              pred.status !== "done" &&
              !!pred.dueDate &&
              !!t.startDate &&
              pred.dueDate >= t.startDate;
          next.push({
            id: `${depKey}>${t.key}`,
            from: depKey,
            to: t.key,
            d,
            ax: x2,
            ay: y2,
            lx,
            ly,
            late,
            color: color(pred.project),
          });
        }
      }
      setLinks(next);
      setLinkSize({ w: box.offsetWidth, h: box.offsetHeight });
      updateClip();
    };
    const updateClip = () => {
      const origin = box.getBoundingClientRect(),
        label = box.querySelector<HTMLElement>(".timelineHeader > b"),
        head = box.querySelector<HTMLElement>(".timelineHeader");
      setClip({
        x: label ? label.getBoundingClientRect().right - origin.left : 245,
        y: head ? head.getBoundingClientRect().bottom - origin.top : 0,
      });
    };
    const card = cardRef.current;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", updateClip, { passive: true });
    card?.addEventListener("scroll", updateClip, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", updateClip);
      card?.removeEventListener("scroll", updateClip);
    };
  }, [view, anchor, collapsed, tasks]);
  useEffect(() => {
    const box = cardRef.current,
      el = box?.querySelector<HTMLElement>("[data-today]");
    if (!box || !el || view !== "timeline") return;
    const left =
      el.getBoundingClientRect().left -
      box.getBoundingClientRect().left +
      box.scrollLeft;
    box.scrollLeft = Math.max(0, left - 245 - 44 * 2);
  }, [view, anchor]);
  // Pin the timeline's date header under the sticky topbar while the browser page scrolls.
  // The card is overflow-x:auto (horizontal scroll), which would trap native `position: sticky`.
  useEffect(() => {
    if (view !== "timeline") return;
    const box = cardRef.current,
      head = box?.querySelector<HTMLElement>(".timelineHeader");
    if (!box || !head) return;
    const update = () => {
      const topbar = document.querySelector<HTMLElement>(".topbar"),
        offset = topbar ? topbar.getBoundingClientRect().bottom : 0,
        rect = box.getBoundingClientRect(),
        max = Math.max(0, rect.height - head.offsetHeight),
        shift = Math.min(max, Math.max(0, offset - rect.top));
      head.style.transform = shift ? `translateY(${shift}px)` : "";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      head.style.transform = "";
    };
  }, [view, anchor, collapsed, tasks]);
  const days = useMemo(
    () =>
      view === "month"
        ? monthGrid(anchor)
        : Array.from({ length: view === "week" ? 7 : 28 }, (_, i) =>
            addDays(
              startOfDay(
                view === "week"
                  ? subDays(anchor, (anchor.getDay() + 6) % 7)
                  : subDays(anchor, 7),
              ),
              i,
            ),
          ),
    [view, anchor],
  );
  const timeline = () => {
    const DAY = 44,
      dated = tasks.filter((t) => t.startDate && t.dueDate),
      stamps = dated.flatMap((t) => [t.startDate!, t.dueDate!]).sort(),
      nextWeekday = (d: Date) => {
        const dow = d.getDay();
        return dow === 6 ? addDays(d, 2) : dow === 0 ? addDays(d, 1) : d;
      },
      from = nextWeekday(
        startOfDay(
          stamps.length && parseISO(stamps[0]) < subDays(anchor, 7)
            ? subDays(parseISO(stamps[0]), 3)
            : subDays(anchor, 7),
        ),
      ),
      last = stamps.length ? parseISO(stamps[stamps.length - 1]) : anchor,
      to = addDays(
        last > addDays(anchor, 180) ? last : addDays(anchor, 180),
        30,
      ),
      tdays = Array.from(
        { length: differenceInCalendarDays(to, from) + 1 },
        (_, i) => addDays(from, i),
      ).filter((d) => d.getDay() !== 0 && d.getDay() !== 6),
      dayIndex = new Map(tdays.map((d, i) => [toISO(d), i])),
      slot = (iso: string) =>
        dayIndex.get(toISO(nextWeekday(startOfDay(parseISO(iso))))) ?? 0,
      todayISO = toISO(nextWeekday(startOfDay(new Date())));
    return (
      <div
        className="timeline"
        style={
          {
            "--day": DAY + "px",
            width: 245 + tdays.length * DAY,
          } as React.CSSProperties
        }
      >
        <div className="timelineHeader">
          <b>Project / task</b>
          <div
            style={{ gridTemplateColumns: `repeat(${tdays.length},${DAY}px)` }}
          >
            {tdays.map((d, i) => (
              <span
                key={d.toISOString()}
                data-today={toISO(d) === todayISO || undefined}
                title={format(d, "d MMM yyyy") + " · click to start the timeline here"}
                className="dayHead"
                role="button"
                tabIndex={0}
                onClick={() =>
                  cardRef.current?.scrollTo({ left: i * DAY, behavior: "smooth" })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    cardRef.current?.scrollTo({ left: i * DAY, behavior: "smooth" });
                  }
                }}
              >
                {format(d, "d")}
                <small>{format(d, "EEEEE")}</small>
                {i === 0 || tdays[i - 1].getMonth() !== d.getMonth() ? (
                  <small>{format(d, "MMM")}</small>
                ) : null}
              </span>
            ))}
          </div>
        </div>
        {projects.map((p) => (
          <div key={p}>
            <button
              type="button"
              className="group"
              aria-expanded={!collapsed[p]}
              onClick={() => setCollapsed((c) => ({ ...c, [p]: !c[p] }))}
            >
              <b>
                {collapsed[p] ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}{" "}
                {projectName(p)}
              </b>
            </button>
            {!collapsed[p] &&
              dated
                .filter((t) => t.project === p)
                .sort(
                  (a, b) =>
                    a.startDate!.localeCompare(b.startDate!) ||
                    a.dueDate!.localeCompare(b.dueDate!),
                )
                .map((t) => {
                  const start = slot(t.startDate!),
                    end = Math.max(start, slot(t.dueDate!)),
                    left = start * DAY,
                    w = Math.max(DAY, (end - start + 1) * DAY),
                    pc = {
                      todo: 0,
                      in_progress: 40,
                      testing: 65,
                      in_review: 80,
                      done: 100,
                    }[t.status];
                  const barColor = hasDependency(t)
                    ? "var(--danger)"
                    : t.ownerTeam === "bmc"
                      ? "var(--success, #16a34a)"
                      : color(p);
                  return (
                    <div className="timelineRow" key={t.id}>
                      <span
                        className={
                          hasDependency(t)
                            ? "dependentName"
                            : t.ownerTeam === "bmc"
                              ? "bmcName"
                              : undefined
                        }
                      >
                        {t.summary}
                        {t.dependsOn?.length ? (
                          <small className="depNote">
                            ↳ dependent
                          </small>
                        ) : null}
                        {t.ownerTeam === "bmc" ? (
                          <small className="bmcNote">BMC</small>
                        ) : null}
                      </span>
                      <div className="lane">
                        <button
                          onClick={() => select(t.id)}
                          className={hasDependency(t) ? "bar dependent" : "bar"}
                          data-key={t.key}
                          onMouseEnter={() => setHoverKey(t.key)}
                          onMouseLeave={() => setHoverKey(null)}
                          onFocus={() => setHoverKey(t.key)}
                          onBlur={() => setHoverKey(null)}
                          style={{
                            left,
                            width: w,
                            borderColor: barColor,
                            background: `color-mix(in srgb, ${barColor} 24%, var(--surface))`,
                          }}
                          title={`${t.summary} · ${statusName[t.status]}${dependencyTitle(t)}`}
                        >
                          <i
                            style={{ width: `${pc}%`, background: color(p) }}
                          />
                          <span className="barText">{t.summary}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
          </div>
        ))}
        <svg
          className="depLinks"
          width={linkSize.w}
          height={linkSize.h}
          aria-hidden
        >
          <defs>
            <clipPath id="depLinksClip">
              <rect
                x={clip.x}
                y={clip.y}
                width={Math.max(0, linkSize.w - clip.x)}
                height={Math.max(0, linkSize.h - clip.y)}
              />
            </clipPath>
          </defs>
          {links.map((l) => {
            const active = hoverKey === l.from || hoverKey === l.to,
              dim = hoverKey !== null && !active,
              stroke = "var(--danger)";
            return (
              <g
                key={l.id}
                clipPath="url(#depLinksClip)"
                className={
                  "depLink" + (l.late ? " late" : "") + (active ? " active" : "") + (dim ? " dim" : "")
                }
              >
                <path d={l.d} stroke={stroke} />
                <path
                  d={`M${l.ax} ${l.ay} l-8 -5 v10 z`}
                  fill={stroke}
                  stroke={stroke}
                />
                <text x={l.lx} y={l.ly} className="depLabel">
                  dependent upon
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };
  const month = () => (
    <div className="month">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => (
        <b key={x}>{x}</b>
      ))}
      {days.map((d) => {
        const iso = toISO(d),
          list = tasks.filter((t) => t.dueDate === iso);
        return (
          <button
            className={iso === toISO(new Date()) ? "day today" : "day"}
            key={iso}
            style={viewOnly ? { cursor: "default" } : undefined}
            onClick={() => !viewOnly && create("todo", iso)}
          >
            <span>{format(d, "d")}</span>
            {list.slice(0, 3).map((t) => (
              <i
                key={t.id}
                className={hasDependency(t) ? "dependent" : undefined}
                title={t.summary + dependencyTitle(t)}
                style={{
                  border: "1px solid " + color(t.project),
                  borderRadius: 999,
                  color: "#000",
                  background:
                    "color-mix(in srgb, " + color(t.project) + " 28%, #fff)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  select(t.id);
                }}
              >
                {t.key} {t.summary}
              </i>
            ))}
            {list.length > 3 && <small>+{list.length - 3} more</small>}
          </button>
        );
      })}
    </div>
  );
  const week = () => (
    <div className="week">
      {days.map((d) => {
        const iso = toISO(d);
        return (
          <div key={iso}>
            <h4>{format(d, "EEE d")}</h4>
            {tasks
              .filter((t) => t.dueDate === iso)
              .map((t) => (
                <button
                  key={t.id}
                  className={hasDependency(t) ? "dependent" : undefined}
                  title={t.summary + dependencyTitle(t)}
                  onClick={() => select(t.id)}
                  style={{
                    border: "1px solid " + color(t.project),
                    borderRadius: 999,
                    color: "#000",
                    background:
                      "color-mix(in srgb, " + color(t.project) + " 28%, #fff)",
                  }}
                >
                  {t.key}
                  <br />
                  {t.summary}
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
  return (
    <section className="section" id="calendar">
      <div className="sectionHead">
        <div>
          <h2>Calendar</h2>
        </div>
        <div className="calendarTools">
          <div className="segments">
            {(["timeline", "month", "week"] as const).map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            className="pill"
            onClick={() =>
              setAnchor(subDays(anchor, view === "month" ? 30 : 7))
            }
          >
            <ChevronLeft />
          </button>
          <button className="pill" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button
            className="pill"
            onClick={() =>
              setAnchor(addDays(anchor, view === "month" ? 30 : 7))
            }
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="card calendarCard" ref={cardRef}>
        {view === "timeline" ? timeline() : view === "month" ? month() : week()}
      </div>
      {view === "timeline" && (
        <p className="depLegend">
          <span>
            <span className="swatch bmc" /> Green: BMC side task
          </span>
          {links.length > 0 && (
            <>
              <span>
                <span className="swatch ok" /> Blinking red line runs from the task that must finish first to the dependent task
              </span>
              <span>
                <span className="swatch late" /> Dashed: the earlier task is not done and runs past the start of the dependent task
              </span>
            </>
          )}
        </p>
      )}
    </section>
  );
}
function TaskDetailsModal() {
  const id = useTaskStore((s) => s.selectedTask),
    task = useTaskStore((s) => s.tasks.find((t) => t.id === s.selectedTask)),
    select = useTaskStore((s) => s.selectTask),
    update = useTaskStore((s) => s.updateTask),
    remove = useTaskStore((s) => s.deleteTask),
    readOnly = useAuthStore((s) => s.user?.role !== "nyneos"),
    [pendingStatus, setPendingStatus] = useState<Status | null>(null),
    [confirmDelete, setConfirmDelete] = useState(false),
    allTasks = useTaskStore((s) => s.tasks);
  if (!id || !task) return null;
  return (
    <>
      <button
        className="taskPopupBackdrop"
        onClick={() => select(null)}
        aria-label="Close task details"
      />
      <div
        className="taskPopup"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <div className="cardHead">
          <span className="key">
            <i style={{ background: color(task.project) }} />
            {task.key} · {task.type}
          </span>
          <div className="popupHeadActions">
            {!readOnly && (
              <button
                className="icon dangerIcon"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete task"
                title="Delete task"
              >
                <Trash2 />
              </button>
            )}
            <button
              className="icon"
              onClick={() => select(null)}
              aria-label="Close task details"
            >
              <X />
            </button>
          </div>
        </div>
        <input
          className="drawerTitle"
          value={task.summary}
          readOnly={readOnly}
          onChange={(event) => update(task.id, { summary: event.target.value })}
        />
        <textarea
          value={task.description}
          readOnly={readOnly}
          onChange={(event) =>
            update(task.id, { description: event.target.value })
          }
        />
        <div className="detailGrid">
          <label>
            Status
            <ModernSelect
              ariaLabel="Task status"
              disabled={readOnly}
              value={task.status}
              options={statuses.map((status) => ({
                value: status,
                label: statusName[status],
              }))}
              onChange={(value) => {
                const next = value as Status;
                if (next !== task.status) setPendingStatus(next);
              }}
            />
          </label>
          <label>
            Priority
            <ModernSelect
              ariaLabel="Task priority"
              disabled={readOnly}
              value={task.priority}
              options={[
                { value: "highest", label: "Highest" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
                { value: "lowest", label: "Lowest" },
              ]}
              onChange={(value) =>
                update(task.id, { priority: value as Task["priority"] })
              }
            />
          </label>
          <label>
            Start date
            <input
              type="date"
              value={task.startDate || ""}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(event) => {
                const v = event.target.value;
                // Any date is allowed; if it passes the due date, the due date moves with it.
                update(
                  task.id,
                  v && task.dueDate && v > task.dueDate
                    ? { startDate: v, dueDate: v }
                    : { startDate: v },
                );
              }}
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={task.dueDate || ""}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(event) => {
                const v = event.target.value;
                // Any date is allowed; if it is before the start date, the start date moves with it.
                update(
                  task.id,
                  v && task.startDate && v < task.startDate
                    ? { dueDate: v, startDate: v }
                    : { dueDate: v },
                );
              }}
            />
          </label>
        </div>
        <div className="teamVisRow">
        <label className="teamField">
          Team
          <ModernSelect
            ariaLabel="Task team"
            disabled={readOnly}
            value={task.ownerTeam ?? "nyneos"}
            options={[
              { value: "nyneos", label: "NyneOS" },
              { value: "bmc", label: "BMC" },
            ]}
            onChange={(value) =>
              update(task.id, { ownerTeam: value as Task["ownerTeam"] })
            }
          />
        </label>
        {!readOnly && (
          <div className="visibilityField">
            Visibility
            <VisibilityToggle
              visible={task.clientVisible !== false}
              onChange={(value) => update(task.id, { clientVisible: value })}
            />
          </div>
        )}
        </div>
        <div className="dependencyField">
          Depends on
          <DependencyPicker
            tasks={allTasks.filter(
              (t) =>
                t.project === task.project &&
                t.key !== task.key &&
                !dependents(allTasks, task.key).has(t.key),
            )}
            selected={task.dependsOn ?? []}
            custom={task.customDependencies ?? []}
            disabled={readOnly}
            onChange={(keys) => update(task.id, { dependsOn: keys })}
            onCustomChange={(values) =>
              update(task.id, { customDependencies: values })
            }
          />
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete task?"
        confirmLabel="Yes, delete task"
        message={task.key + " · " + task.summary + " will be permanently deleted. This cannot be undone."}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove(task.id);
        }}
      />
      <ConfirmDialog
        open={pendingStatus !== null}
        title="Change task status?"
        confirmLabel="Yes, change status"
        message={
          pendingStatus
            ? task.key +
              " will move from " +
              statusName[task.status] +
              " to " +
              statusName[pendingStatus] +
              ". Are you sure?"
            : ""
        }
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => {
          if (pendingStatus)
            update(task.id, {
              status: pendingStatus,
              completedAt:
                pendingStatus === "done"
                  ? task.completedAt || new Date().toISOString()
                  : null,
            });
          setPendingStatus(null);
        }}
      />
    </>
  );
}
function Dashboard() {
  const canBoard = useAuthStore((s) => !!s.user?.canManageBoard),
    viewOnly = useAuthStore((s) => s.user?.role === "bmc"),
    tasks = useTaskStore(useShallow(selectFiltered)),
    all = useTaskStore((s) => s.tasks),
    filters = useTaskStore((s) => s.filters),
    setFilters = useTaskStore((s) => s.setFilters),
    [modal, setModal] = useState(false),
    [defaults, setDefaults] = useState<{ status: Status; date?: string }>({
      status: "todo",
    }),
    [toast, setToast] = useState("");
  const create = (status: Status = "todo", date?: string) => {
    if (viewOnly) return;
    setDefaults({ status, date });
    setModal(true);
  };
  const created = (key: string) => {
    setToast(`${key} created`);
    setModal(false);
    setTimeout(() => setToast(""), 3500);
  };
  return (
    <>
      <div className="accentStrip" />
      <Header create={() => create()} />
      <main>
        <section className="hero">
          <h1>
            Project Dashboard
            <span />
          </h1>
          <div className="projectChips">
            <button
              className={filters.project === "all" ? "active" : ""}
              onClick={() => setFilters({ project: "all" })}
            >
              All <b>{all.length}</b>
            </button>
            {projects.map((p) => (
              <button
                className={filters.project === p ? "active" : ""}
                onClick={() => setFilters({ project: p })}
                key={p}
              >
                <i style={{ background: color(p) }} />
                {projectName(p)}{" "}
                <b>{all.filter((t) => t.project === p).length}</b>
              </button>
            ))}
          </div>
        </section>
        <ProjectSummary />
        <div className="widgets">
          {/* <MyTasks create={() => create()} /> */}
          <Overview tasks={tasks} />
          {/* <Trend tasks={tasks} /> */}
          <Progress tasks={tasks} />
        </div>
        {canBoard && <Board create={(s) => create(s)} />}
        <Calendar create={create} viewOnly={viewOnly} />
        <footer className="siteFooter">
          <Logos footer />
          <span>
            © Bombay Mercantile Co-operative Bank Ltd. · Powered by NyneOS
            Technologies
          </span>
        </footer>
      </main>
      <TaskModal
        open={modal}
        status={defaults.status}
        date={defaults.date}
        onClose={() => setModal(false)}
        onCreated={created}
      />
      <TaskDetailsModal />
      {toast && (
        <div className="toast" role="status">
          {toast} <button onClick={() => setToast("")}>Dismiss</button>
        </div>
      )}
    </>
  );
}
export default function App() {
  const user = useAuthStore((s) => s.user),
    checking = useAuthStore((s) => s.checking),
    restore = useAuthStore((s) => s.restore),
    logout = useAuthStore((s) => s.logout),
    loadAll = useTaskStore((s) => s.loadAll),
    loaded = useTaskStore((s) => s.loaded),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    void restore();
    const out = () => logout();
    addEventListener("bmb:unauthorized", out);
    return () => removeEventListener("bmb:unauthorized", out);
  }, [restore, logout]);
  useEffect(() => {
    if (user) {
      setLoadError("");
      loadAll().catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Unable to load data"),
      );
    }
  }, [user, loadAll]);
  if (checking) return <div className="loginPage" />;
  if (!user) return <Login />;
  if (loadError)
    return (
      <div className="loginPage">
        <div className="card loginCard">
          <h1>Can't reach the server</h1>
          <p className="loginError">{loadError}</p>
          <button className="primary" onClick={logout}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  if (!loaded) return <div className="loginPage" />;
  return <Dashboard />;
}
