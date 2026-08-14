import {API_BASE_URL} from './config.js';

let redirectTimer;

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
    all: (task) => !task.is_deleted,
    today: (task) => isSameDay(task.due_date, new Date()) && !task.is_deleted,
    important: (task) => task.is_important,
    upcoming: (task) => !isSameDay(task.due_date, new Date()) && new Date(task.due_date) > new Date() && !task.is_deleted,
    expired: (task) => isExpired(task) && !task.is_deleted,
    completed: (task) => task.is_done && !task.is_deleted,
    archived: (task) => task.is_archived && !task.is_deleted,
    deleted: (task) => task.is_deleted,
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
    const passwordNotMatchingImg = document.getElementById('password-not-matching-icon');
    const passwordNotMatchingMsg = document.getElementById('password-not-matching-msg');

    function confirmRegisterPassword() {
        const password = registerPassword.value;
        const confirm_password = confirmRegPassword.value;

        if (confirm_password !== password) {
            confirmRegPassword.classList.add('input-error');
            passwordNotMatchingImg.style.display = 'flex';
            passwordNotMatchingMsg.style.display = 'flex';
            return false;
        } else {
            confirmRegPassword.classList.remove('input-error');
            passwordNotMatchingImg.style.display = 'none';
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

    function showNewTaskForm() {
        newTaskItem.reset();

        if (currentFilterId === 'today') {
            const today = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateString = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
            newTaskDate.value = dateString;
            dueDateText.textContent = dateString;
        } else {
            dueDateText.textContent = 'Set date';
        }

        dueTimeText.textContent = 'Set time';
        newTaskBtn.style.display = 'none';
        newTaskItem.style.display = 'flex';
        newTaskInput.focus();
    }

    function hideNewTaskForm() {
        newTaskItem.classList.add('hiding');

        newTaskItem.addEventListener('animationend', (e) => {
            newTaskItem.classList.remove('hiding');
            newTaskItem.style.display = 'none';
            newTaskBtn.style.display = 'flex';
        }, {once: true});
    }

    newTaskBtn.addEventListener('click', (e) => {
        showNewTaskForm();
    });

    newTaskCancelBtn.addEventListener('click', (e) => {
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
                body: data,
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

    let currentTasks = [];
    let currentFilterId = 'all';

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

            allTasksHTML += `
                <div class="task-item ${task.is_done ? "completed" : ''} ${isExpired(task) ? "expired-task" : ''}" data-id="${task.id}">
                    <input type="checkbox" class="task-checkbox" id="task-${task.id}" ${task.is_done ? "checked" : ''}>
                    <div class="task-body" id="body-${task.id}">
                        <span class="task-text">${task.text}</span>
                    </div>
                    <div class="task-meta">
                        ${hasDueDate ? hasDueDateHtml : hasNoDueDateHtml}
                        <button class="task-delete-btn" id="delete-${task.id}">
                            <i data-lucide="trash-2" class="task-icon"></i>
                        </button> 
                    </div>
                </div>
            `
        }

        const oldTasks = tasksList.querySelectorAll('.task-item:not(.new-task-item)');
        oldTasks.forEach(task => task.remove());

        tasksList.insertAdjacentHTML('beforeend', allTasksHTML);

        lucide.createIcons();
    }

    function refreshUI() {
        const filteredTasks = filterTasks(currentTasks, currentFilterId);
        renderTasks(filteredTasks);
    }

    document.addEventListener('app:authSuccess', async (e) => {
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
                body: data,
            });

            if (response.ok) {
                const targetTask = currentTasks.find(task => task.id === Number(taskId));
                if (targetTask) {
                    Object.assign(targetTask, payloadObject);
                    return true;
                } else {
                    return false;
                }
            } else {
                console.log('Task operation failed');
                return false;
            }
        } catch (error) {
            console.log('Task operation error: ', error);
            return false;
        }
    }

    tasksList.addEventListener('click', async (e) => {
        const clickedCheckbox = e.target.closest('.task-checkbox');
        const clickedText = e.target.closest('.task-text');
        const clickedDateTime = e.target.closest('.due-date-wrapper');
        const clickedDelete = e.target.closest('.task-delete-btn');

        if (clickedCheckbox) {
            const taskItemElement = clickedCheckbox.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            const isCompleted = clickedCheckbox.checked;
            const payloadObject = {
                is_done: isCompleted
            }

            const isSuccess = await sendTaskRequest(taskId, 'PUT', payloadObject);

            if (isSuccess) {
                refreshUI();
            } else {
                taskItemElement.classList.remove('completed');
                clickedCheckbox.checked = !isCompleted;
            }
        }

        if (clickedText) {
            const taskItemElement = clickedText.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            e.preventDefault();

            const originalText = clickedText.textContent;

            let inputTextElement = document.createElement('input');
            inputTextElement.type = 'text';
            inputTextElement.value = originalText;
            inputTextElement.className = 'task-text edit-task-input';

            clickedText.replaceWith(inputTextElement);
            inputTextElement.focus();

            let isProcessing = false;

            async function replaceText(newText) {
                if (newText === originalText || newText === '') {
                    inputTextElement.replaceWith(clickedText);
                    return;
                }

                const payloadObject = {
                    text: newText
                }

                const isTextUpdated = await sendTaskRequest(taskId, 'PUT', payloadObject);

                if (isTextUpdated) {
                    refreshUI();
                } else {
                    inputTextElement.replaceWith(clickedText);
                }
            }

            inputTextElement.addEventListener('keydown', async (e) => {
                if (e.key === 'Escape') {
                    isProcessing = true;
                    inputTextElement.replaceWith(clickedText);
                }

                if (e.key === 'Enter') {
                    if (isProcessing) return;
                    isProcessing = true;
                    const newText = e.target.value.trim();

                    await replaceText(newText);
                }
            });

            inputTextElement.addEventListener('blur', async (e) => {
                if (isProcessing) return;
                isProcessing = true;
                const newText = e.target.value.trim();

                await replaceText(newText);
            });
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

                const isDateTimeUpdated = await sendTaskRequest(taskId, 'PUT', payloadObject);

                if (isDateTimeUpdated) {
                    refreshUI();
                } else {
                    inputDateTimeElement.replaceWith(clickedDateTime);
                }
            });

            inputDateTimeElement.addEventListener('blur', async (e) => {
                if (isProcessing) return;

                inputDateTimeElement.replaceWith(clickedDateTime);
            });
        }

        if (clickedDelete) {
            const taskItemElement = clickedDelete.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');

            const isDeleted = await sendTaskRequest(taskId, 'DELETE');

            if (isDeleted) {
                currentTasks = currentTasks.filter(task => task.id !== Number(taskId));
                refreshUI();
            }
        }
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
    initSidebarLogic();
    initPageHeaderLogic();

    await fetchAndRenderUser();
});