import {API_BASE_URL} from './config.js';

let redirectTimer;
let currentTasks = [];

async function sendTaskRequest(taskId, method, payloadObject) {
    const token = localStorage.getItem('access_token');
    const data = payloadObject ? JSON.stringify(payloadObject) : null;

    try {
        const response = await fetch(API_BASE_URL + '/items/' + taskId, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: data
        });

        if (response.ok) {
            const targetTask = currentTasks.find(task => task.id === Number(taskId));
            if (targetTask) {
                Object.assign(targetTask, payloadObject);
                return {success: true, status: response.status};
            } else {
                return {success: false, status: response.status};
            }
        } else {
            console.log('Task operation failed');
            return {success: false, status: response.status};
        }
    } catch (error) {
        console.log('Task operation error: ', error);
        return {success: false, status: null};
    }
}

async function createTaskRequest(payload) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(API_BASE_URL + '/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const newTask = await response.json();
            return {success: true, task: newTask, status: response.status};
        } else {
            console.log('New item creation failed', response.status);
            return {success: false, status: response.status};
        }
    } catch (error) {
        console.log('New item creation failed: ', error);
        return {success: false, status: null};
    }
}

async function deleteTaskPermanently(taskId) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(API_BASE_URL + '/items/' + taskId + '/permanent', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        if (response.ok) {
            return {success: true, status: response.status};
        } else {
            console.log('Permanent delete failed');
            return {success: false, status: response.status};
        }
    } catch (error) {
        console.log('Permanent delete error: ', error);
        return {success: false, status: null};
    }
}

function switchView(targetID) {
    const pages = document.querySelectorAll('.app-view');
    for (const page of pages) {
        page.style.display = 'none';
    }

    const to_show = document.getElementById(targetID);
    if (to_show) {
        to_show.style.display = 'flex';
    } else {
        console.error('View not found: ' + targetID);
    }
}

function showLoginPageSection(sectionId) {
    document.querySelectorAll('.login-page-element')
        .forEach(el => {
            el.style.display = 'none';
        });
    document.getElementById(sectionId).style.display = 'flex';
}

let toastTimeout;

function showErrorToast(message) {
    const toast = document.getElementById('error-toast');
    const toastMessage = document.getElementById('toast-message');

    clearTimeout(toastTimeout);
    toastMessage.textContent = message;
    toast.classList.add('visible');

    toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

function renderUserProfile(userData) {
    const firstName = userData.first_name;
    const lastName = userData.last_name;

    const iconInitials = firstName[0].toUpperCase() + lastName[0].toUpperCase();
    const displayName = firstName + ' ' + lastName;

    const userAvatar = document.getElementById('user-avatar');
    const username = document.getElementById('user-name');

    userAvatar.textContent = iconInitials;
    username.textContent = displayName;
}

async function fetchAndRenderUser() {
    const token = localStorage.getItem('access_token');

    if (token) {
        try {
            const response = await fetch(API_BASE_URL + '/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                renderUserProfile(userData);
                switchView('todo-page');
                document.dispatchEvent(new Event('app:authSuccess'));
            } else {
                switchView('login-page');
            }
        } catch (error) {
            switchView('login-page');
        }
    } else {
        switchView('login-page');
    }
}

function reformatDateTime(rawDateTime) {
    const dateToDisplay = rawDateTime.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(rawDateTime.getFullYear() !== new Date().getFullYear() ? {year: 'numeric'} : {})
    });
    const timeToDisplay = rawDateTime.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    });

    return dateToDisplay + ', ' + timeToDisplay;
}

function toDatetimeLocalValue(isoUtcString) {
    const d = new Date(isoUtcString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSameDay(dueDate, otherDate) {
    if (dueDate === null || dueDate === undefined) {
        return false;
    }

    dueDate = new Date(dueDate);
    if (dueDate && otherDate) {
        return dueDate.getFullYear() === otherDate.getFullYear() && dueDate.getMonth() === otherDate.getMonth() && dueDate.getDate() === otherDate.getDate();
    }
}

function isExpired(task) {
    if (task.due_date === null || task.due_date === undefined) {
        return false;
    }

    return new Date(task.due_date) < new Date() && !task.is_done;
}

const filters = {
    all: (task) => !task.is_deleted && !task.is_done && !task.is_archived,
    today: (task) => isSameDay(task.due_date, new Date()) && !task.is_deleted && !task.is_archived,
    important: (task) => task.is_important && !task.is_archived && !task.is_deleted,
    upcoming: (task) => !isSameDay(task.due_date, new Date()) && new Date(task.due_date) > new Date() && !task.is_deleted && !task.is_archived && !task.is_done,
    expired: (task) => isExpired(task) && !task.is_deleted && !task.is_archived && !task.is_done,
    completed: (task) => task.is_done && !task.is_archived && !task.is_deleted,
    archived: (task) => task.is_archived && !task.is_deleted,
    deleted: (task) => !task.is_archived && task.is_deleted,
};

const pageTitles = {
    all: 'All Tasks',
    today: 'Today\'s Tasks',
    important: 'Important Tasks',
    upcoming: 'Upcoming Tasks',
    expired: 'Expired Tasks',
    completed: 'Completed Tasks',
    deleted: 'Deleted Tasks',
}

function filterTasks(tasks, filterId) {
    const predicate = filters[filterId] || filters.all;
    return tasks.filter(predicate);
}

function getDepth(task, tasksById) {
    let depth = 0;
    let current = task;
    while (current.parent_id !== null && current.parent_id !== undefined) {
        current = tasksById.get(current.parent_id);
        if (!current) break;
        depth++;
    }
    return depth;
}

function initLoginLogic() {
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginForm = document.getElementById('login-form');
    const invalidCredentialsMessage = document.getElementById('invalid-cred-msg');
    const showRegisterBtn = document.getElementById('show-register-btn');

    loginEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginPassword.focus();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        invalidCredentialsMessage.style.display = 'none';
        loginEmail.classList.remove('input-error');
        loginPassword.classList.remove('input-error');

        const formData = new FormData(loginForm);
        const data = new URLSearchParams(formData);

        try {
            const response = await fetch(API_BASE_URL + '/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: data
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('access_token', result.access_token);
                localStorage.setItem('refresh_token', result.refresh_token);
                await fetchAndRenderUser();
            } else {
                invalidCredentialsMessage.style.display = 'flex';
                loginEmail.classList.add('input-error');
                loginPassword.classList.add('input-error');
            }
        } catch (error) {
            console.log('Login failed:', error);
        }
    });

    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPageSection('register-section');
    });
}

function initRegisterLogic() {
    const registerFirstName = document.getElementById('register-first-name');
    const registerLastName = document.getElementById('register-last-name');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const confirmRegPassword = document.getElementById('confirm-register-password');
    const registerForm = document.getElementById('register-form');
    const emailInUseIcon = document.getElementById('email-in-use-icon');
    const emailInUseMsg = document.getElementById('email-in-use-msg');
    const show_login_btn = document.getElementById('show-login-btn');
    const passwordNotMatchingMsg = document.getElementById('password-not-matching-msg');

    function confirmRegisterPassword() {
        const password = registerPassword.value;
        const confirm_password = confirmRegPassword.value;

        if (confirm_password !== password) {
            confirmRegPassword.classList.add('input-error');
            passwordNotMatchingMsg.style.display = 'flex';
            return false;
        } else {
            confirmRegPassword.classList.remove('input-error');
            passwordNotMatchingMsg.style.display = 'none';
            return true;
        }
    }

    registerFirstName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            registerLastName.focus();
        }
    });
    registerLastName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            registerEmail.focus();
        }
    });
    registerEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            registerPassword.focus();
        }
    });
    registerPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmRegPassword.focus();
        }
    });
    confirmRegPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (confirmRegisterPassword() === true)
                registerForm.requestSubmit();
        }
    });
    confirmRegPassword.addEventListener('blur', (e) => {
        confirmRegisterPassword();
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        registerEmail.classList.remove('input-error');
        emailInUseIcon.style.display = 'none';
        emailInUseMsg.style.display = 'none';

        const formData = new FormData(registerForm);

        const password = formData.get('password');
        const confirm_password = formData.get('confirm-register-password');

        if (password !== confirm_password) {
            return;
        }

        formData.delete('confirm-register-password');

        const dataObject = Object.fromEntries(formData.entries());

        const data = JSON.stringify(dataObject);

        try {
            const response = await fetch(API_BASE_URL + '/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: data
            });

            if (response.ok) {
                showLoginPageSection('success-section');
                redirectTimer = setTimeout(() => {
                    showLoginPageSection('login-section');
                }, 2000);
            } else if (response.status === 409) {
                registerEmail.classList.add('input-error');
                emailInUseIcon.style.display = 'flex';
                emailInUseMsg.style.display = 'flex';
            } else {
                console.error('Unexpected server error');
            }
        } catch (error) {
            console.log('Register failed: ', error);
        }
    });

    show_login_btn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPageSection('login-section');
    });
}

function initSuccessfulLoginLogic() {
    const redirectToLogin = document.getElementById('redirect-to-login');
    redirectToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        clearTimeout(redirectTimer);
        showLoginPageSection('login-section');
    });
}

function initLogoutLogic() {
    const logoutBtn = document.getElementById('logout-btn');
    const tasksList = document.getElementById('tasks-list');

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();

        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');

        tasksList.innerHTML = '';

        switchView('login-page');
    });
}

function initNewTaskCreationLogic() {
    const newTaskDate = document.getElementById('new-task-date');
    const dueDateText = document.getElementById('due-date-text');
    const dueTimeText = document.getElementById('due-time-text');
    const newTaskTime = document.getElementById('new-task-time');
    const newTaskBtn = document.getElementById('new-task-btn');
    const newTaskItem = document.getElementById('new-task-item');
    const newTaskInput = document.getElementById('new-task-input');
    const newTaskCancelBtn = document.getElementById('new-task-cancel-btn');

    let currentFilterId = 'all';

    newTaskDate.addEventListener('click', (e) => {
        try {
            if ('showPicker' in HTMLInputElement.prototype) {
                newTaskDate.showPicker();
            }
        } catch (error) {
            console.log('Date picker failed: ', error);
        }
    });

    newTaskDate.addEventListener('change', (e) => {
        dueDateText.textContent = e.target.value;
    });

    newTaskTime.addEventListener('click', (e) => {
        try {
            if ('showPicker' in HTMLInputElement.prototype) {
                newTaskTime.showPicker();
            }
        } catch (error) {
            console.log('Time picker failed: ', error);
        }
    });

    newTaskTime.addEventListener('change', (e) => {
        dueTimeText.textContent = e.target.value;
    });

    // function showNewTaskForm() {
    //     newTaskItem.reset();
    //
    //     if (currentFilterId === 'today') {
    //         const today = new Date();
    //         const pad = (n) => String(n).padStart(2, '0');
    //         const dateString = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    //         newTaskDate.value = dateString;
    //         dueDateText.textContent = dateString;
    //     } else {
    //         dueDateText.textContent = 'Set date';
    //     }
    //
    //     dueTimeText.textContent = 'Set time';
    //     newTaskBtn.style.display = 'none';
    //     newTaskItem.style.display = 'flex';
    //     newTaskInput.focus();
    // }

    function hideNewTaskForm() {
        newTaskItem.classList.add('hiding');

        newTaskItem.addEventListener('animationend', (e) => {
            newTaskItem.classList.remove('hiding');
            newTaskItem.style.display = 'none';
            newTaskBtn.style.display = 'flex';
        }, {once: true});
    }

    newTaskBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('app:openTaskModal', {detail: null}));
    });

    newTaskCancelBtn.addEventListener('click', () => {
        hideNewTaskForm();
    });

    newTaskItem.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('access_token');

        hideNewTaskForm();

        const formData = new FormData(newTaskItem)
        const date = formData.get('date');
        const time = formData.get('time');
        if (date && time) {
            const localDateTime = new Date(`${date}T${time}`)
            formData.append('due_date', localDateTime.toISOString());
        }

        formData.delete('date');
        formData.delete('time');

        const dataObject = Object.fromEntries(formData.entries());
        const data = JSON.stringify(dataObject);

        try {
            const response = await fetch(API_BASE_URL + '/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: data
            });

            if (response.ok) {
                const newTask = await response.json();

                document.dispatchEvent(new CustomEvent('app:itemCreated', {
                    detail: newTask
                }));
            } else {
                console.log('Item creation failed: ', response.body);
            }
        } catch (error) {
            console.log('New item creation failed: ', error);
        }
    });

    document.addEventListener('app:sidebarChanged', (e) => {
        currentFilterId = e.detail.filterId;

        if (newTaskItem.style.display === 'flex') {
            hideNewTaskForm();
        }
    });
}

function initTaskManagementLogic() {
    const tasksList = document.getElementById('tasks-list');
    const taskMenu = document.getElementById('task-menu');

    let currentFilterId = 'all';
    let activeMenuTaskId = null;

    async function fetchUserTasks() {
        const token = localStorage.getItem('access_token');

        if (token) {
            try {
                const response = await fetch(API_BASE_URL + '/items', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    }
                });

                if (response.ok) {
                    return await response.json();
                } else {
                    console.log('Unexpected server error');
                    return [];
                }
            } catch (error) {
                console.log('Unable to get user\'s tasks: ' + error);
                return [];
            }
        } else {
            console.log('Unauthorized');
            return [];
        }
    }

    function renderTasks(tasksArray) {
        let allTasksHTML = '';

        for (const task of tasksArray) {
            let hasDueDate = true;
            if (task.due_date === null || task.due_date === undefined) {
                hasDueDate = false;
            }

            let rawDate = null, dueDate = null;
            if (hasDueDate) {
                rawDate = new Date(task.due_date);
                dueDate = reformatDateTime(rawDate);
            }

            const hasDueDateHtml = `
                <div class="due-date-wrapper">
                    ${isExpired(task) ? "<i data-lucide='circle-alert' class='task-icon'></i>" : ''}
                    <i data-lucide="calendar" class="task-icon"></i>
                    <span class="task-due" id="due-${task.id}">
                        Due ${currentFilterId === "today" ? dueDate.split(',').pop().trim() : dueDate}
                    </span>
                </div>
            `

            const hasNoDueDateHtml = `
                <div class="due-date-wrapper">
                    <i data-lucide="calendar-plus-2" class="task-icon no-due-date-icon"></i>
                    <span class="task-due no-due-date" id="due-${task.id}">
                        Add Due Date
                    </span>
                </div>
            `

            const actionButtonHtml = currentFilterId === "deleted"
                ? `<button type="button" class="task-restore-btn" id="restore-${task.id}">
                        <i data-lucide="rotate-ccw" class="task-icon"></i>
                    </button>`
                : `<button type="button" class="task-menu-btn" id="menu-${task.id}">
                        <i data-lucide="ellipsis" class="task-menu-icon"></i>
                    </button>`

            allTasksHTML += `
                <div class="task-item ${task.is_done ? "completed" : ''} ${isExpired(task) ? "expired-task" : ''} ${currentFilterId === "deleted" ? "task-item-locked" : ''} ${task.is_important ? "important" : ''}" data-id="${task.id}">
                    <input type="checkbox" class="task-checkbox" id="task-${task.id}" ${task.is_done ? "checked" : ''}>
                    <div class="task-body" id="body-${task.id}">
                        <span class="task-title-wrapper">
                            <span class="task-title">${task.title}</span>
                            <span class="task-title-tooltip-outer">
                                <span class="task-title-tooltip">${task.title}</span>
                            </span>
                        </span>
                        <span class="task-desc-wrapper">
                            <span class="task-desc">${task.description}</span>
                            <span class="task-desc-tooltip-outer">
                                <span class="task-desc-tooltip">${task.description}</span>
                            </span>
                        </span>
                    </div>
                    <div class="task-meta">
                        ${hasDueDate ? hasDueDateHtml : hasNoDueDateHtml}
                        ${actionButtonHtml}
                    </div>
                </div>
            `
        }

        const oldTasks = tasksList.querySelectorAll('.task-item:not(.new-task-item)');
        oldTasks.forEach(task => task.remove());

        tasksList.insertAdjacentHTML('beforeend', allTasksHTML);

        requestAnimationFrame(() => {
            markTruncatedText();
            lucide.createIcons();
        });
    }

    function markTruncatedText() {
        const textElements = tasksList.querySelectorAll('.task-title, .task-desc');
        textElements.forEach(el => {
            const isTruncated = el.scrollWidth > el.clientWidth;
            el.closest('.task-title-wrapper, .task-desc-wrapper').classList.toggle('has-tooltip', isTruncated);
        });
    }

    function sortTasks(tasks) {
        return [...tasks].sort((a, b) => {
            const aExpired = isExpired(a);
            const bExpired = isExpired(b);
            if (aExpired !== bExpired) return aExpired ? -1 : 1;

            if (a.is_important !== b.is_important) return a.is_important ? -1 : 1;

            if (a.due_date === null && b.due_date === null) return 0;
            if (a.due_date === null) return 1;
            if (b.due_date === null) return -1;

            return new Date(a.due_date) - new Date(b.due_date);
        });
    }

    function refreshUI() {
        const filteredTasks = filterTasks(currentTasks, currentFilterId);
        const sortedTasks = sortTasks(filteredTasks);
        renderTasks(sortedTasks);
    }

    document.addEventListener('app:authSuccess', async () => {
        currentTasks = await fetchUserTasks();
        refreshUI();
    });

    document.addEventListener('app:itemCreated', (e) => {
        const newTask = e.detail;
        currentTasks.push(newTask);
        refreshUI();
    });

    document.addEventListener('app:sidebarChanged', (e) => {
        currentFilterId = e.detail.filterId;
        refreshUI();
    });

    tasksList.addEventListener('click', async (e) => {
        const clickedItem = e.target.closest('.task-item');
        const clickedCheckbox = e.target.closest('.task-checkbox');
        const clickedDateTime = e.target.closest('.due-date-wrapper');
        const clickedMenuBtn = e.target.closest('.task-menu-btn');
        const clickedRestore = e.target.closest('.task-restore-btn');

        if (clickedCheckbox) {
            const taskItemElement = clickedCheckbox.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            const isCompleted = clickedCheckbox.checked;
            const payloadObject = {
                is_done: isCompleted
            }

            const result = await sendTaskRequest(taskId, 'PUT', payloadObject);

            if (result.success) {
                taskItemElement.classList.add('removing');
                setTimeout(() => {
                    refreshUI();
                }, 150);
            } else {
                showErrorToast('Something went wrong. Please try again.');
                taskItemElement.classList.remove('completed');
                clickedCheckbox.checked = !isCompleted;
            }
        }

        if (clickedDateTime) {
            const taskItemElement = clickedDateTime.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            e.preventDefault();

            const targetTask = currentTasks.find(task => task.id === Number(taskId));
            const originalDateTime = targetTask.due_date;

            let formatedDateTime = '';
            if (originalDateTime !== null && originalDateTime !== undefined) {
                formatedDateTime = toDatetimeLocalValue(originalDateTime);
            }

            let inputDateTimeElement = document.createElement('input');
            inputDateTimeElement.type = 'datetime-local';
            inputDateTimeElement.value = formatedDateTime;
            inputDateTimeElement.className = 'edit-datetime-input';

            clickedDateTime.replaceWith(inputDateTimeElement);
            inputDateTimeElement.focus();

            setTimeout(() => {
                inputDateTimeElement.showPicker();
            }, 0);

            let isProcessing = false;

            inputDateTimeElement.addEventListener('change', async (e) => {
                if (isProcessing) return;
                isProcessing = true;
                const inputValue = e.target.value.trim();

                let newDateTime = inputValue === '' ? null : new Date(inputValue).toISOString();

                const payloadObject = {
                    due_date: newDateTime
                }

                const result = await sendTaskRequest(taskId, 'PUT', payloadObject);

                if (result.success) {
                    refreshUI();
                } else {
                    showErrorToast('Something went wrong. Please try again.');
                    inputDateTimeElement.replaceWith(clickedDateTime);
                }
            });

            inputDateTimeElement.addEventListener('blur', async () => {
                if (isProcessing) return;

                inputDateTimeElement.replaceWith(clickedDateTime);
            });
        }

        if (clickedMenuBtn) {
            const taskItemElement = clickedMenuBtn.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            if (activeMenuTaskId === taskId) {
                closeMenu();
            } else {
                openMenu(clickedMenuBtn, taskId);
            }
        }

        if (clickedRestore) {
            const taskItemElement = clickedRestore.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            const payloadObject = {
                is_deleted: false,
            }

            const result = await sendTaskRequest(taskId, 'PUT', payloadObject);

            if (result.success) {
                taskItemElement.classList.add('removing');
                setTimeout(() => {
                    refreshUI();
                }, 150);
            } else if (result.status === 404) {
                currentTasks = currentTasks.filter(task => task.id !== Number(taskId));
                refreshUI();
                showErrorToast('This task has already been permanently deleted');
            } else {
                showErrorToast('Something went wrong. Please try again.');
            }
        }

        const hasSpecificAction = clickedCheckbox || clickedDateTime || clickedMenuBtn || clickedRestore;

        if (!hasSpecificAction && clickedItem && !clickedItem.classList.contains('new-task-item')) {
            const taskId = clickedItem.getAttribute('data-id');
            const targetTask = currentTasks.find(task => task.id === Number(taskId));

            if (targetTask) {
                document.dispatchEvent(new CustomEvent('app:openTaskModal', {
                    detail: targetTask
                }));
            }
        }
    });

    function openMenu(triggerBtn, taskId) {
        const targetTask = currentTasks.find(task => task.id === Number(taskId));

        const importantItem = taskMenu.querySelector('[data-action="important"]');
        importantItem.textContent = targetTask.is_important ? 'Remove Importance' : 'Mark Important';

        const archiveItem = taskMenu.querySelector('[data-action="archive"]');
        archiveItem.textContent = targetTask.is_archived ? 'Unarchive' : 'Archive';

        const rect = triggerBtn.getBoundingClientRect();
        const containerRect = tasksList.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2;

        let left = buttonCenterX - taskMenu.offsetWidth / 2;
        const minLeft = containerRect.left + 8;
        const maxLeft = containerRect.right - taskMenu.offsetWidth - 8;
        left = Math.min(Math.max(left, minLeft), maxLeft);

        taskMenu.style.top = `${rect.bottom + 4}px`;
        taskMenu.style.left = `${left}px`;
        taskMenu.classList.add('visible');
        activeMenuTaskId = taskId;
    }

    function closeMenu() {
        taskMenu.classList.remove('visible');
        activeMenuTaskId = null;
    }

    taskMenu.addEventListener('click', async (e) => {
        const clickedItem = e.target.closest('.task-menu-item');
        if (!clickedItem || activeMenuTaskId === null) return;

        const action = clickedItem.dataset.action;
        const taskId = activeMenuTaskId;
        const targetTask = currentTasks.find(task => task.id === Number(taskId));

        if (!targetTask) {
            showErrorToast('Something went wrong. Please try again.');
            closeMenu();
            return;
        }

        if (action === 'delete') {
            const result = await sendTaskRequest(taskId, 'DELETE');

            if (result.success) {
                const targetTask = currentTasks.find(task => task.id === Number(taskId));
                if (targetTask) {
                    targetTask.is_deleted = true;
                }

                const taskItemElement = document.querySelector(`.task-item[data-id="${taskId}"]`);

                if (taskItemElement) {
                    taskItemElement.classList.add('removing');
                    setTimeout(() => {
                        refreshUI();
                    }, 150);
                } else {
                    refreshUI();
                }
            } else {
                showErrorToast('Something went wrong. Please try again.');
            }

            closeMenu();
            return;
        }

        let payloadObject;

        switch (action) {
            case 'important': {
                payloadObject = {
                    is_important: !targetTask.is_important,
                }
                break;
            }
            case 'archive': {
                payloadObject = {
                    is_archived: !targetTask.is_archived,
                }
                break;
            }
            default:
                closeMenu();
                return;
        }

        const result = await sendTaskRequest(taskId, 'PUT', payloadObject);

        if (result.success) {
            const taskItemElement = document.querySelector(`.task-item[data-id="${taskId}"]`);

            if (taskItemElement && action === 'archive') {
                taskItemElement.classList.add('removing');
                setTimeout(() => {
                    refreshUI();
                }, 150);
            } else {
                refreshUI();
            }
        } else {
            showErrorToast('Something went wrong. Please try again.');
        }

        closeMenu();
    });

    document.addEventListener('click', (e) => {
        if (activeMenuTaskId === null) return;
        if (!e.target.closest('.task-menu') && !e.target.closest('.task-menu-btn')) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeMenuTaskId !== null) {
            closeMenu();
        }
    });

    document.addEventListener('app:taskUpdated', () => {
        refreshUI();
    });
}

function initTaskModalLogic() {
    const taskDetailsModal = document.getElementById('task-details-modal');
    const modalCompleteBtn = document.getElementById('modal-complete-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalImportantBtn = document.getElementById('modal-important-btn');
    const modalTitleText = document.getElementById('modal-title-text');
    const modalMissingTitleMsg = document.getElementById('modal-missing-title-msg');
    const modalDescriptionText = document.getElementById('modal-desc-text');
    const modalOverdueBadge = document.getElementById('modal-overdue-badge');
    const modalDueDateControl = document.getElementById('modal-due-date-control');
    const modalDueDateText = document.getElementById('modal-due-date-text');
    const modalProjectControl = document.getElementById('modal-project-control');
    const modalProjectText = document.getElementById('modal-project-text');
    const modalCompletedSubtasksCounter = document.getElementById('modal-completed-subtasks-counter');
    const modalAddSubtaskBtn = document.getElementById('modal-add-subtask-btn');
    const modalSubtasksList = document.getElementById('modal-subtasks-list');
    const modalArchiveBtn = document.getElementById('modal-archive-btn');
    const modalDeleteBtn = document.getElementById('modal-delete-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalCreateTaskBtn = document.getElementById('modal-create-task-btn');

    let currentTask;
    let activeEdit = false;
    let isCreatingTask = false;
    let suppressBackdropClose = false;

    async function updateCurrentTask(payloadObject) {
        if (isCreatingTask && !currentTask.id) {
            if (!currentTask.title && !payloadObject.title) {
                modalTitleText.classList.add('modal-missing-title-error');
                modalMissingTitleMsg.style.display = 'flex';
                return false;
            }
            const result = await createTaskRequest(payloadObject);
            if (result.success) {
                currentTask.id = result.task.id;
                Object.assign(currentTask, result.task);
                document.dispatchEvent(new CustomEvent('app:itemCreated', {detail: currentTask}));
                return true;
            } else {
                showErrorToast('Something went wrong. Please try again.');
                return false;
            }
        }

        const result = await sendTaskRequest(currentTask.id, 'PUT', payloadObject);

        if (result.success) {
            document.dispatchEvent(new CustomEvent('app:taskUpdated', {detail: currentTask}));
            return true;
        } else {
            showErrorToast('Something went wrong. Please try again.');
            return false;
        }
    }

    function closeModal() {
        taskDetailsModal.classList.add('hiding');

        taskDetailsModal.addEventListener('animationend', (e) => {
            if (e.target !== taskDetailsModal) return;

            taskDetailsModal.classList.remove('hiding');
            taskDetailsModal.style.display = 'none';
            currentTask = null;
        }, {once: true});
    }

    async function deleteCurrentTask() {
        const result = await sendTaskRequest(currentTask.id, 'DELETE');

        if (result.success) {
            currentTask.is_deleted = true;

            const taskItemElement = document.querySelector(`.task-item[data-id="${currentTask.id}"]`);
            if (taskItemElement) {
                taskItemElement.classList.add('removing');
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('app:taskUpdated', {detail: currentTask}));
                }, 150);
            } else {
                document.dispatchEvent(new CustomEvent('app:taskUpdated', {detail: currentTask}));
            }

            closeModal();
        } else {
            showErrorToast('Something went wrong. Please try again.');
        }
    }

    async function requestClose() {
        if (isCreatingTask && currentTask?.id) {
            const result = await deleteTaskPermanently(currentTask.id);
            if (!result.success) {
                showErrorToast('Something went wrong. Please try again.');
                return;
            }
        }
        closeModal();
    }

    function refreshModalVisual() {
        const hasDueDate = currentTask.due_date !== null && currentTask.due_date !== undefined;
        const overdue = isExpired(currentTask);

        modalDueDateControl.classList.toggle('modal-widget-unset-value', !hasDueDate);
        modalDueDateControl.classList.toggle('task-overdue', overdue);
        modalDueDateText.textContent = hasDueDate ? reformatDateTime(new Date(currentTask.due_date)) : 'Add Due Date';
        modalOverdueBadge.classList.toggle('active', overdue);

        const dueDateIcon = hasDueDate ? 'calendar' : 'calendar-plus-2';
        document.getElementById('modal-due-date-icon').outerHTML =
            `<i data-lucide="${dueDateIcon}" class="modal-widget-icon" id="modal-due-date-icon"></i>`;
        lucide.createIcons();
    }

    document.addEventListener('app:openTaskModal', (e) => {
        activeEdit = false;
        suppressBackdropClose = false;
        currentTask = e.detail ?? {title: '', description: null, due_date: null, is_important: null, is_archived: null};
        isCreatingTask = e.detail === null;

        modalTitleText.classList.remove('modal-unset-title', 'modal-missing-title-error');
        modalMissingTitleMsg.style.display = 'none';
        taskDetailsModal.classList.remove('hiding');
        taskDetailsModal.style.display = 'flex';
        modalDueDateControl.classList.remove('modal-widget-unset-value');
        modalDueDateControl.classList.remove('task-overdue');

        if (isCreatingTask) {
            modalTitleText.classList.add('modal-unset-title');
            modalTitleText.textContent = 'Task Name';

            modalDescriptionText.textContent = 'Add a more detailed description...';
            modalDescriptionText.classList.add('modal-unset-value-text');

            modalDueDateControl.classList.remove('task-overdue');
            modalDueDateControl.classList.add('modal-widget-unset-value');
            modalDueDateText.classList.add('modal-unset-value-text');
            modalDueDateText.textContent = 'Add Due Date';
            document.getElementById('modal-due-date-icon').outerHTML =
                `<i data-lucide="calendar-plus-2" class="modal-widget-icon" id="modal-due-date-icon"></i>`;
            lucide.createIcons();

            modalProjectControl.classList.add('modal-widget-unset-value');
            modalProjectText.classList.add('modal-unset-value-text');
            modalProjectText.textContent = 'Move to Project...';

            // TODO SUBTASKS CREATION

            modalTitleText.click();
        } else {
            modalCompleteBtn.classList.toggle('completed', currentTask.is_done);
            modalImportantBtn.classList.toggle('active', currentTask.is_important);

            modalTitleText.textContent = currentTask.title;

            const hasDescription = currentTask.description !== null && currentTask.description !== undefined;
            modalDescriptionText.classList.toggle('modal-unset-value-text', !hasDescription);
            modalDescriptionText.textContent = hasDescription ? currentTask.description : 'Add a more detailed description...';

            refreshModalVisual();

            // TODO PROJECT AND SUBTASKS CREATION

            const archiveIcon = currentTask.is_archived ? 'archive-restore' : 'archive';
            const archiveLabel = currentTask.is_archived ? 'Unarchive' : 'Move to Archive';
            document.getElementById('modal-archive-icon').outerHTML =
                `<i data-lucide="${archiveIcon}" class="modal-actions-icon" id="modal-archive-icon"></i>`;
            document.getElementById('modal-archive-label').textContent = archiveLabel;
            lucide.createIcons();
        }

        modalCompleteBtn.style.display = isCreatingTask ? 'none' : 'flex';
        modalCompletedSubtasksCounter.style.display = isCreatingTask ? 'none' : 'inline-flex';
        modalArchiveBtn.style.display = isCreatingTask ? 'none' : 'flex';
        modalDeleteBtn.style.display = isCreatingTask ? 'none' : 'flex';
        modalCreateTaskBtn.style.display = isCreatingTask ? 'flex' : 'none';
        modalCancelBtn.style.display = isCreatingTask ? 'flex' : 'none';
    });

    modalCloseBtn.addEventListener('click', async () => {
        await requestClose();
    });

    taskDetailsModal.addEventListener('click', async (e) => {
        if (suppressBackdropClose) {
            suppressBackdropClose = false;
            return;
        }

        if (e.target === taskDetailsModal && !activeEdit) {
            isCreatingTask = false;
            await requestClose();
        }
    });

    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape' && taskDetailsModal.style.display === 'flex' && !activeEdit) {
            await requestClose();
        }
    });

    modalCompleteBtn.addEventListener('click', async () => {
        const success = await updateCurrentTask({is_done: !currentTask.is_done});
        if (success) closeModal();
    });

    modalTitleText.addEventListener('click', () => {
        if (activeEdit) return;
        activeEdit = true;
        modalImportantBtn.style.display = 'none';

        const originalText = currentTask.title;

        const textAreaElement = document.createElement('textarea');
        textAreaElement.value = originalText;
        textAreaElement.className = 'modal-task-title edit-textarea edit-title-textarea';
        textAreaElement.placeholder = 'Task Name'
        textAreaElement.maxLength = 255;
        textAreaElement.rows = 1;

        modalTitleText.replaceWith(textAreaElement);

        function autoResize() {
            textAreaElement.style.height = 'auto';
            textAreaElement.style.height = textAreaElement.scrollHeight + 'px';
        }

        autoResize();
        textAreaElement.addEventListener('input', autoResize);

        textAreaElement.setSelectionRange(originalText.length, originalText.length);
        textAreaElement.focus({preventScroll: true});
        textAreaElement.scrollIntoView({block: 'end'});

        let isProcessing = false;

        async function commit() {
            const newText = textAreaElement.value.trim();

            if (newText === '' || newText === originalText) {
                textAreaElement.replaceWith(modalTitleText);
                activeEdit = false;
                modalImportantBtn.style.display = 'flex';
                return;
            }

            const success = await updateCurrentTask({title: newText});
            if (success) {
                modalTitleText.textContent = newText;
                modalTitleText.classList.remove('modal-unset-title', 'modal-missing-title-error');
                modalMissingTitleMsg.style.display = 'none';
            }
            textAreaElement.replaceWith(modalTitleText);
            activeEdit = false;
            modalImportantBtn.style.display = 'flex';
        }

        textAreaElement.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape') {
                if (isProcessing) return;
                isProcessing = true;
                textAreaElement.replaceWith(modalTitleText);
                setTimeout(() => {
                    activeEdit = false;
                    modalImportantBtn.style.display = 'flex';
                }, 0);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (isProcessing) return;
                isProcessing = true;
                await commit();
            }
        });

        textAreaElement.addEventListener('blur', async () => {
            suppressBackdropClose = true;
            if (isProcessing) return;
            isProcessing = true;
            await commit();
        });
    });

    modalImportantBtn.addEventListener('click', async () => {
        const newValue = !currentTask.is_important;
        const success = await updateCurrentTask({is_important: newValue});
        if (success) modalImportantBtn.classList.toggle('active', newValue);
    });

    modalDescriptionText.addEventListener('click', () => {
        if (activeEdit) return;
        activeEdit = true;

        const hasDescription = currentTask.description !== null && currentTask.description !== undefined;
        const originalText = hasDescription ? currentTask.description : '';

        const textAreaElement = document.createElement('textarea');
        textAreaElement.value = originalText;
        textAreaElement.className = 'modal-task-desc edit-textarea edit-desc-textarea';
        textAreaElement.maxLength = 5000;
        textAreaElement.rows = 1;
        textAreaElement.placeholder = 'Add a more detailed description...';

        modalDescriptionText.replaceWith(textAreaElement);

        function autoResize() {
            textAreaElement.style.height = 'auto';
            textAreaElement.style.height = textAreaElement.scrollHeight + 'px';
        }

        autoResize();
        textAreaElement.addEventListener('input', autoResize);

        textAreaElement.setSelectionRange(originalText.length, originalText.length);
        textAreaElement.focus({preventScroll: true});
        textAreaElement.scrollIntoView({block: 'end'});

        let isProcessing = false;

        async function commit() {
            const newText = textAreaElement.value.trim();

            if (newText === originalText) {
                textAreaElement.replaceWith(modalDescriptionText);
                activeEdit = false;
                return;
            }

            const payloadDescription = newText === '' ? null : newText;
            const success = await updateCurrentTask({description: payloadDescription});

            if (success) {
                if (payloadDescription === null) {
                    modalDescriptionText.textContent = 'Add a more detailed description...';
                    modalDescriptionText.classList.add('modal-unset-value-text');
                } else {
                    modalDescriptionText.textContent = newText;
                    modalDescriptionText.classList.remove('modal-unset-value-text');
                }
            }

            textAreaElement.replaceWith(modalDescriptionText);
            activeEdit = false;
        }

        textAreaElement.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape') {
                if (isProcessing) return;
                isProcessing = true;
                textAreaElement.replaceWith(modalDescriptionText);
                setTimeout(() => {
                    activeEdit = false;
                }, 0);
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();

                if (isProcessing) return;
                isProcessing = true;
                await commit();
            }
        });

        textAreaElement.addEventListener('blur', async () => {
            suppressBackdropClose = true;
            if (isProcessing) return;
            isProcessing = true;
            await commit();
        });
    });

    modalDueDateControl.addEventListener('click', () => {
        if (activeEdit) return;
        activeEdit = true;

        const originalDateTime = currentTask.due_date;

        let formatedDateTime = '';
        if (originalDateTime !== null && originalDateTime !== undefined) {
            formatedDateTime = toDatetimeLocalValue(originalDateTime);
        }

        let inputDateTimeElement = document.createElement('input');
        inputDateTimeElement.type = 'datetime-local';
        inputDateTimeElement.value = formatedDateTime;
        inputDateTimeElement.className = 'modal-widget-control edit-datetime-input';

        modalDueDateControl.replaceWith(inputDateTimeElement);
        inputDateTimeElement.focus();

        setTimeout(() => {
            inputDateTimeElement.showPicker();
        }, 0);

        let isProcessing = false;

        async function commit() {
            const inputValue = inputDateTimeElement.value.trim();
            const newDateTime = inputValue === '' ? null : new Date(inputValue).toISOString();

            if (newDateTime !== originalDateTime) {
                await updateCurrentTask({due_date: newDateTime});
            }

            inputDateTimeElement.replaceWith(modalDueDateControl);
            refreshModalVisual();
            activeEdit = false;
        }

        inputDateTimeElement.addEventListener('change', async () => {
            if (isProcessing) return;
            isProcessing = true;
            await commit();
        });

        inputDateTimeElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                isProcessing = true;
                inputDateTimeElement.replaceWith(modalDueDateControl);
                setTimeout(() => {
                    activeEdit = false;
                }, 0);
            }
        });

        inputDateTimeElement.addEventListener('blur', async () => {
            suppressBackdropClose = true;
            if (isProcessing) return;
            if (inputDateTimeElement)
                inputDateTimeElement.replaceWith(modalDueDateControl);
            await commit();
        });
    });

    modalArchiveBtn.addEventListener('click', async () => {
        const newValue = !currentTask.is_archived;
        const success = await updateCurrentTask({is_archived: newValue});
        if (success) closeModal();
    });

    modalDeleteBtn.addEventListener('click', async () => {
        await deleteCurrentTask();
    });

    modalCancelBtn.addEventListener('click', async () => {
        await requestClose();
    });

    modalCreateTaskBtn.addEventListener('click', async () => {
        if (!currentTask.id) {
            modalTitleText.classList.add('modal-missing-title-error');
            modalMissingTitleMsg.style.display = 'flex';
            modalTitleText.click();
            return;
        }
        isCreatingTask = false;
        closeModal();
    });
}

function initSidebarLogic() {
    const sidebarContents = document.getElementById('sidebar-contents');
    sidebarContents.addEventListener('click', (e) => {
        const clickedBtn = e.target.closest('.sidebar-btn');

        if (clickedBtn === null || clickedBtn === undefined) {
            return;
        }

        const currActiveBtn = document.querySelector('.sidebar-btn.active');
        currActiveBtn?.classList.remove('active');
        clickedBtn.classList.add('active');

        const clickedBtnId = clickedBtn.id;
        const filterId = clickedBtnId.split('-').pop();

        document.dispatchEvent(new CustomEvent('app:sidebarChanged', {
            detail: {filterId: filterId}
        }));
    });
}

function initPageHeaderLogic() {
    document.addEventListener('app:sidebarChanged', (e) => {
        const filterId = e.detail.filterId;
        document.getElementById('curr-title').textContent = pageTitles[filterId] || 'Tasks';
        document.getElementById('additional-info').textContent = new Date().toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    });
}

// DOM

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    initLoginLogic();
    initRegisterLogic();
    initSuccessfulLoginLogic();
    initLogoutLogic();
    initNewTaskCreationLogic();
    initTaskManagementLogic();
    initTaskModalLogic();
    initSidebarLogic();
    initPageHeaderLogic();

    await fetchAndRenderUser();
});