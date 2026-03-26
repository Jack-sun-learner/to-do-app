(() => {
  const STORAGE_KEY = "todo_tasks_v1";
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const IMPORT_SOURCE_KEYS = ["tasks", "todos", "items", "data", "results"];
  const IMPORT_BUTTON_LABEL = "导入 URL 任务";
  const FLOATING_PREVIEW_LIMIT = 5;

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
    importForm: document.getElementById("importForm"),
    importUrlInput: document.getElementById("importUrlInput"),
    importBtn: document.getElementById("importBtn"),
    importStatus: document.getElementById("importStatus"),
    floatingDock: document.querySelector(".floating-dock"),
    floatingToggle: document.getElementById("floatingToggle"),
    floatingCount: document.getElementById("floatingCount"),
    floatingPanel: document.getElementById("floatingPanel"),
    floatingPanelSummary: document.getElementById("floatingPanelSummary"),
    floatingPriorityStats: document.getElementById("floatingPriorityStats"),
    floatingHighCount: document.getElementById("floatingHighCount"),
    floatingMediumCount: document.getElementById("floatingMediumCount"),
    floatingLowCount: document.getElementById("floatingLowCount"),
    floatingTodoList: document.getElementById("floatingTodoList"),
    floatingEmptyState: document.getElementById("floatingEmptyState"),
    floatingPanelFooter: document.getElementById("floatingPanelFooter"),
    floatingMoreHint: document.getElementById("floatingMoreHint"),
    floatingExpandBtn: document.getElementById("floatingExpandBtn"),
    floatingCloseBtn: document.getElementById("floatingCloseBtn"),
  };

  /** @type {{id:string,text:string,priority:"high"|"medium"|"low",completed:boolean,createdAt:number}[]} */
  let tasks = [];
  let floatingPanelPinned = false;
  let floatingShowAll = false;

  /** @param {unknown} p */
  function normalizePriority(p) {
    if (p === "high" || p === "medium" || p === "low") return p;
    if (typeof p === "number") {
      if (p >= 3) return "high";
      if (p <= 1) return "low";
      return "medium";
    }
    if (typeof p === "string") {
      const value = p.trim().toLowerCase();
      if (["high", "urgent", "highest", "h", "高"].includes(value)) return "high";
      if (["low", "lowest", "l", "低"].includes(value)) return "low";
      if (["medium", "normal", "mid", "m", "中"].includes(value)) return "medium";
    }
    return "medium";
  }

  /** @param {"high"|"medium"|"low"} p */
  function priorityLabel(p) {
    if (p === "high") return "高";
    if (p === "low") return "低";
    return "中";
  }

  /** @param {"high"|"medium"|"low"} p */
  function priorityRank(p) {
    return PRIORITY_ORDER[p] ?? PRIORITY_ORDER.medium;
  }

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
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

  function getSortedIncompleteTasks() {
    return tasks
      .filter((task) => !task.completed)
      .slice()
      .sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) || a.createdAt - b.createdAt
      );
  }

  function setImportStatus(message, tone = "") {
    if (!els.importStatus) return;
    els.importStatus.textContent = message;
    if (tone) {
      els.importStatus.dataset.tone = tone;
      return;
    }
    delete els.importStatus.dataset.tone;
  }

  function setImportLoading(isLoading) {
    if (els.importBtn) {
      els.importBtn.disabled = isLoading;
      els.importBtn.textContent = isLoading ? "导入中..." : IMPORT_BUTTON_LABEL;
    }
    if (els.importUrlInput) {
      els.importUrlInput.disabled = isLoading;
    }
  }

  /** @param {unknown} value */
  function normalizeCompleted(value) {
    if (typeof value === "string") {
      const nextValue = value.trim().toLowerCase();
      if (["true", "1", "yes", "y", "done"].includes(nextValue)) return true;
      if (["false", "0", "no", "n", "todo"].includes(nextValue)) return false;
    }
    return Boolean(value);
  }

  function setFloatingPanelOpen(isOpen) {
    if (!els.floatingPanel || !els.floatingToggle) return;
    els.floatingPanel.hidden = !isOpen;
    els.floatingPanel.classList.toggle("is-open", isOpen);
    els.floatingToggle.setAttribute("aria-expanded", String(isOpen));
  }

  function renderFloatingPanel() {
    if (!els.floatingTodoList) return;

    const pendingTasks = getSortedIncompleteTasks();
    const counts = {
      high: pendingTasks.filter((task) => task.priority === "high").length,
      medium: pendingTasks.filter((task) => task.priority === "medium").length,
      low: pendingTasks.filter((task) => task.priority === "low").length,
    };
    const hasOverflow = pendingTasks.length > FLOATING_PREVIEW_LIMIT;
    const visibleTasks =
      floatingShowAll || !hasOverflow
        ? pendingTasks
        : pendingTasks.slice(0, FLOATING_PREVIEW_LIMIT);

    if (!hasOverflow) {
      floatingShowAll = false;
    }

    els.floatingTodoList.innerHTML = "";

    if (els.floatingCount) {
      els.floatingCount.textContent = String(pendingTasks.length);
    }

    if (els.floatingPanelSummary) {
      if (pendingTasks.length === 0) {
        els.floatingPanelSummary.textContent = "当前未完成任务已经清空。";
      } else if (hasOverflow && !floatingShowAll) {
        els.floatingPanelSummary.textContent = `当前共 ${pendingTasks.length} 条未完成任务，先看最紧急的 ${FLOATING_PREVIEW_LIMIT} 条。`;
      } else {
        els.floatingPanelSummary.textContent = `当前共 ${pendingTasks.length} 条未完成任务，已按高到低排序。`;
      }
    }

    if (els.floatingHighCount) {
      els.floatingHighCount.textContent = `高 ${counts.high}`;
    }
    if (els.floatingMediumCount) {
      els.floatingMediumCount.textContent = `中 ${counts.medium}`;
    }
    if (els.floatingLowCount) {
      els.floatingLowCount.textContent = `低 ${counts.low}`;
    }

    if (els.floatingEmptyState) {
      els.floatingEmptyState.hidden = pendingTasks.length !== 0;
    }

    if (els.floatingPriorityStats) {
      els.floatingPriorityStats.hidden = pendingTasks.length === 0;
    }

    if (els.floatingPanelFooter) {
      els.floatingPanelFooter.hidden = !hasOverflow;
    }

    if (els.floatingMoreHint) {
      const remainingCount = Math.max(pendingTasks.length - FLOATING_PREVIEW_LIMIT, 0);
      els.floatingMoreHint.textContent =
        hasOverflow && !floatingShowAll
          ? `还有 ${remainingCount} 条待办未展开`
          : `已展示全部 ${pendingTasks.length} 条待办`;
    }

    if (els.floatingExpandBtn) {
      els.floatingExpandBtn.textContent = floatingShowAll ? "收起预览" : "展开全部";
      els.floatingExpandBtn.setAttribute("aria-expanded", String(floatingShowAll));
    }

    for (const task of visibleTasks) {
      const item = document.createElement("li");
      item.className = "floating-todo-item";
      item.dataset.id = task.id;

      if (task.priority === "high") {
        item.classList.add("is-urgent");
      }

      const meta = document.createElement("div");
      meta.className = "floating-todo-meta";

      const badge = document.createElement("span");
      badge.className = `priority-badge priority-${task.priority}`;
      badge.textContent = `${priorityLabel(task.priority)}优先`;

      const text = document.createElement("p");
      text.className = "floating-todo-text";
      text.textContent = task.text;

      meta.appendChild(badge);
      meta.appendChild(text);

      const doneBtn = document.createElement("button");
      doneBtn.type = "button";
      doneBtn.className = "floating-complete-btn";
      doneBtn.textContent = "完成";
      doneBtn.setAttribute("aria-label", `完成任务：${task.text}`);

      item.appendChild(meta);
      item.appendChild(doneBtn);

      els.floatingTodoList.appendChild(item);
    }
  }

  function render() {
    els.todoList.innerHTML = "";

    if (tasks.length === 0) {
      els.emptyState.hidden = false;
    } else {
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
    }

    updateCounts();
    renderFloatingPanel();
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

  function addImportedTasks(importedTasks) {
    const next = [...tasks, ...importedTasks];
    saveTasks(next);
    render();
  }

  function deleteTask(id) {
    const next = tasks.filter((t) => t.id !== id);
    saveTasks(next);
    render();
  }

  function toggleTask(id, completed) {
    if (!id) return;
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

  function enterEditMode(row, task) {
    row.classList.add("editing");

    const label = row.querySelector("label.task-label");
    if (!label) return;
    label.innerHTML = "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox";
    checkbox.checked = task.completed;
    checkbox.disabled = true;
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

  function getImportItems(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    for (const key of IMPORT_SOURCE_KEYS) {
      if (Array.isArray(payload[key])) return payload[key];
    }

    if (
      typeof payload.text === "string" ||
      typeof payload.title === "string" ||
      typeof payload.name === "string"
    ) {
      return [payload];
    }

    return [];
  }

  function getImportText(item) {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object") return "";

    const candidates = [item.text, item.title, item.name, item.task, item.content];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return "";
  }

  function normalizeImportedTask(item, index) {
    const text = getImportText(item);
    if (!text) return null;

    const prioritySource =
      item && typeof item === "object"
        ? item.priority ?? item.level ?? item.importance ?? item.rank
        : undefined;
    const completedSource =
      item && typeof item === "object"
        ? item.completed ?? item.done ?? item.isDone ?? item.finished
        : false;

    return {
      id: uid(),
      text,
      priority: normalizePriority(prioritySource),
      completed: normalizeCompleted(completedSource),
      createdAt: Date.now() + index,
    };
  }

  function parseImportedTasks(payload) {
    const importItems = getImportItems(payload);
    return importItems
      .map((item, index) => normalizeImportedTask(item, index))
      .filter((task) => task !== null);
  }

  async function importTasksFromUrl(inputUrl) {
    const response = await fetch(inputUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`请求失败（${response.status}）`);
    }

    const payload = await response.json();
    const importedTasks = parseImportedTasks(payload);

    if (importedTasks.length === 0) {
      throw new Error("没有在返回内容里找到可导入的任务");
    }

    addImportedTasks(importedTasks);
    return importedTasks.length;
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

  if (els.importForm) {
    els.importForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const rawUrl = (els.importUrlInput && els.importUrlInput.value) || "";
      const nextUrl = rawUrl.trim();

      if (!nextUrl) {
        setImportStatus("请输入一个可访问的 JSON URL。", "error");
        return;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(nextUrl, window.location.href);
      } catch {
        setImportStatus("URL 格式不正确，请检查后再试。", "error");
        return;
      }

      setImportLoading(true);
      setImportStatus("正在导入远程任务...", "loading");

      try {
        const count = await importTasksFromUrl(parsedUrl.toString());
        setImportStatus(`导入成功，已加入 ${count} 条任务。`, "success");
        if (els.importUrlInput) {
          els.importUrlInput.value = "";
        }
      } catch (error) {
        let message = "导入失败，请确认目标地址允许跨域访问并返回 JSON 数据。";
        if (error instanceof SyntaxError) {
          message = "返回内容不是合法的 JSON，暂时无法导入。";
        } else if (error instanceof TypeError) {
          message = "请求失败，请确认 URL 可访问且目标服务器允许跨域访问。";
        } else if (error instanceof Error && error.message) {
          message = error.message;
        }
        setImportStatus(message, "error");
      } finally {
        setImportLoading(false);
      }
    });
  }

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

  if (els.floatingTodoList) {
    els.floatingTodoList.addEventListener("click", (e) => {
      const completeBtn =
        e.target && e.target.closest && e.target.closest("button.floating-complete-btn");
      if (!completeBtn) return;

      const item = completeBtn.closest("li.floating-todo-item");
      if (!item || !item.dataset.id) return;
      toggleTask(item.dataset.id, true);
    });
  }

  if (els.floatingExpandBtn) {
    els.floatingExpandBtn.addEventListener("click", () => {
      floatingShowAll = !floatingShowAll;
      renderFloatingPanel();
    });
  }

  if (els.floatingDock) {
    els.floatingDock.addEventListener("mouseenter", () => {
      setFloatingPanelOpen(true);
    });

    els.floatingDock.addEventListener("mouseleave", () => {
      if (!floatingPanelPinned) {
        setFloatingPanelOpen(false);
      }
    });

    els.floatingDock.addEventListener("focusin", () => {
      setFloatingPanelOpen(true);
    });

    els.floatingDock.addEventListener("focusout", () => {
      window.requestAnimationFrame(() => {
        if (!els.floatingDock.contains(document.activeElement) && !floatingPanelPinned) {
          setFloatingPanelOpen(false);
        }
      });
    });
  }

  if (els.floatingToggle) {
    els.floatingToggle.addEventListener("click", () => {
      floatingPanelPinned = !floatingPanelPinned;
      setFloatingPanelOpen(true);
      if (
        !floatingPanelPinned &&
        els.floatingDock &&
        !els.floatingDock.matches(":hover") &&
        !els.floatingDock.contains(document.activeElement)
      ) {
        setFloatingPanelOpen(false);
      }
    });
  }

  if (els.floatingCloseBtn) {
    els.floatingCloseBtn.addEventListener("click", () => {
      floatingPanelPinned = false;
      setFloatingPanelOpen(false);
      if (els.floatingToggle) {
        els.floatingToggle.focus();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!els.floatingPanel || els.floatingPanel.hidden) return;
    floatingPanelPinned = false;
    setFloatingPanelOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (!els.floatingDock || !els.floatingPanel || els.floatingPanel.hidden) return;
    if (els.floatingDock.contains(e.target)) return;
    floatingPanelPinned = false;
    setFloatingPanelOpen(false);
  });

  tasks = loadTasks();
  render();
})();
