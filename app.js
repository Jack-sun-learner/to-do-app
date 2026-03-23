(() => {
  const STORAGE_KEY = "todo_tasks_v1";

  const els = {
    addForm: document.getElementById("addForm"),
    taskInput: document.getElementById("taskInput"),
    prioritySelect: document.getElementById("prioritySelect"),
    todoList: document.getElementById("todoList"),
    emptyState: document.getElementById("emptyState"),
    activeCount: document.getElementById("activeCount"),
    completedCount: document.getElementById("completedCount"),
    clearCompletedBtn: document.getElementById("clearCompletedBtn"),
    clearAllBtn: document.getElementById("clearAllBtn"),
  };

  /** @type {{id:string,text:string,priority:"high"|"medium"|"low",completed:boolean,createdAt:number}[]} */
  let tasks = [];

  /** @param {unknown} p */
  function normalizePriority(p) {
    if (p === "high" || p === "medium" || p === "low") return p;
    return "medium";
  }

  /** @param {"high"|"medium"|"low"} p */
  function priorityLabel(p) {
    if (p === "high") return "高";
    if (p === "low") return "低";
    return "中";
  }

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    // Fallback: not cryptographically strong, but fine for localStorage IDs.
    return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x) => x && typeof x.id === "string" && typeof x.text === "string")
        .map((x) => ({
          id: x.id,
          text: x.text,
          priority: normalizePriority(x.priority),
          completed: Boolean(x.completed),
          createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
        }));
    } catch {
      return [];
    }
  }

  function saveTasks(next) {
    tasks = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function updateCounts() {
    const completed = tasks.filter((t) => t.completed).length;
    const active = tasks.length - completed;
    els.completedCount.textContent = String(completed);
    els.activeCount.textContent = String(active);
    if (els.clearCompletedBtn) {
      els.clearCompletedBtn.disabled = completed === 0;
    }
    if (els.clearAllBtn) {
      els.clearAllBtn.disabled = tasks.length === 0;
    }
  }

  function render() {
    els.todoList.innerHTML = "";

    if (tasks.length === 0) {
      els.emptyState.hidden = false;
      updateCounts();
      return;
    }

    els.emptyState.hidden = true;

    for (const task of tasks) {
      const li = document.createElement("li");
      li.className = `todo-row${task.completed ? " completed" : ""}`;
      li.dataset.id = task.id;

      const label = document.createElement("label");
      label.className = "task-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "checkbox";
      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", `标记完成：${task.text}`);

      const badge = document.createElement("span");
      badge.className = `priority-badge priority-${task.priority}`;
      badge.textContent = priorityLabel(task.priority);

      const span = document.createElement("span");
      span.className = "task-text";
      span.textContent = task.text;

      label.appendChild(checkbox);
      label.appendChild(badge);
      label.appendChild(span);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "delete-btn";
      delBtn.setAttribute("aria-label", `删除任务：${task.text}`);
      delBtn.textContent = "删除";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit-btn";
      editBtn.setAttribute("aria-label", `编辑任务：${task.text}`);
      editBtn.textContent = "编辑";

      li.appendChild(label);
      li.appendChild(editBtn);
      li.appendChild(delBtn);

      els.todoList.appendChild(li);
    }

    updateCounts();
  }

  function addTask(text, priority) {
    const next = [
      ...tasks,
      {
        id: uid(),
        text,
        priority,
        completed: false,
        createdAt: Date.now(),
      },
    ];
    saveTasks(next);
    render();
  }

  function deleteTask(id) {
    const next = tasks.filter((t) => t.id !== id);
    saveTasks(next);
    render();
  }

  function toggleTask(id, completed) {
    const next = tasks.map((t) => (t.id === id ? { ...t, completed } : t));
    saveTasks(next);
    render();
  }

  function updateTask(id, nextText, nextPriority) {
    const next = tasks.map((t) =>
      t.id === id ? { ...t, text: nextText, priority: normalizePriority(nextPriority) } : t
    );
    saveTasks(next);
    render();
  }

  function clearCompleted() {
    const next = tasks.filter((t) => !t.completed);
    saveTasks(next);
    render();
  }

  function clearAll() {
    saveTasks([]);
    render();
  }

  els.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (els.taskInput.value || "").trim();
    if (!text) return;
    const priority = els.prioritySelect ? normalizePriority(els.prioritySelect.value) : "medium";
    addTask(text, priority);
    els.taskInput.value = "";
    els.taskInput.focus();
  });

  if (els.clearCompletedBtn) {
    els.clearCompletedBtn.addEventListener("click", () => {
      clearCompleted();
    });
  }

  if (els.clearAllBtn) {
    els.clearAllBtn.addEventListener("click", () => {
      const ok = window.confirm("确定要全部清空吗？此操作无法撤销。");
      if (!ok) return;
      clearAll();
    });
  }

  function enterEditMode(row, task) {
    row.classList.add("editing");

    const label = row.querySelector("label.task-label");
    if (!label) return;
    label.innerHTML = "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox";
    checkbox.checked = task.completed;
    checkbox.disabled = true; // avoid toggling completion while editing
    checkbox.setAttribute("aria-label", `标记完成：${task.text}`);

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "edit-text-input";
    textInput.value = task.text;
    textInput.maxLength = 200;
    textInput.setAttribute("aria-label", "编辑任务内容");

    const select = document.createElement("select");
    select.className = "edit-priority-select";
    select.setAttribute("aria-label", "编辑任务优先级");
    for (const p of ["high", "medium", "low"]) {
      const option = document.createElement("option");
      option.value = p;
      option.textContent = priorityLabel(p);
      if (p === task.priority) option.selected = true;
      select.appendChild(option);
    }

    label.appendChild(checkbox);
    label.appendChild(textInput);
    label.appendChild(select);

    // Hide existing actions; we'll replace them with save/cancel.
    const editBtn = row.querySelector("button.edit-btn");
    if (editBtn) editBtn.hidden = true;
    const delBtn = row.querySelector("button.delete-btn");
    if (delBtn) delBtn.hidden = true;

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-small btn-primary save-btn";
    saveBtn.textContent = "保存";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-small btn-secondary cancel-btn";
    cancelBtn.textContent = "取消";

    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);

    textInput.focus();
    textInput.setSelectionRange(0, textInput.value.length);
  }

  els.todoList.addEventListener("click", (e) => {
    const row = e.target && e.target.closest && e.target.closest("li.todo-row");
    if (!row) return;
    const id = row.dataset.id;
    if (!id) return;

    const saveBtn = e.target && e.target.closest && e.target.closest("button.save-btn");
    if (saveBtn) {
      const input = row.querySelector("input.edit-text-input");
      const select = row.querySelector("select.edit-priority-select");
      if (!input || !select) return;
      const nextText = (input.value || "").trim();
      if (!nextText) return;
      updateTask(id, nextText, select.value);
      return;
    }

    const cancelBtn = e.target && e.target.closest && e.target.closest("button.cancel-btn");
    if (cancelBtn) {
      render();
      return;
    }

    const editBtn = e.target && e.target.closest && e.target.closest("button.edit-btn");
    if (editBtn) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      enterEditMode(row, task);
      return;
    }

    const delBtn = e.target && e.target.closest && e.target.closest("button.delete-btn");
    if (delBtn) {
      deleteTask(id);
    }
  });

  els.todoList.addEventListener("change", (e) => {
    const checkbox = e.target;
    if (!(checkbox && checkbox.matches && checkbox.matches("input.checkbox"))) return;

    const row = checkbox.closest("li.todo-row");
    if (!row) return;
    toggleTask(row.dataset.id, checkbox.checked);
  });

  // Init
  tasks = loadTasks();
  render();
})();

