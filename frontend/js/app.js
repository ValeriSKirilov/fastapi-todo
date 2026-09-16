import {API_BASE_URL} from './config.js';

let redirectTimer;
let currentTasks = [];
const MAX_SUBTASK_DEPTH = 2;

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

async function cascadeSubtaskCompletion(taskId, isDone, tasksArray) {
    const childrenByParent = new Map();
    for (const task of tasksArray) {
        if (task.parent_id !== null && task.parent_id !== undefined) {
            if (!childrenByParent.has(task.parent_id)) {
                childrenByParent.set(task.parent_id, []);
            }
            childrenByParent.get(task.parent_id).push(task);
        }
    }

    const descendants = [];

    function collect(id) {
        const children = childrenByParent.get(id);
        if (!children) return;
        for (const child of children) {
            descendants.push(child);
            collect(child.id);
        }
    }

    collect(taskId);

    if (descendants.length === 0) {
        return true;
    }

    const results = await Promise.all(
        descendants.map(task => sendTaskRequest(task.id, 'PUT', {is_done: isDone}))
    );

    descendants.forEach((task, index) => {
        if (results[index].success)
            task.is_done = isDone;
    });

    return results.every(r => r.success);
}

async function completeTaskWithCascade(taskId, isDone) {
    const result = await sendTaskRequest(taskId, 'PUT', {is_done: isDone});
    if (!result.success) {
        return {success: false};
    }

    const task = currentTasks.find(t => t.id === Number(taskId));
    if (task) task.is_done = isDone;

    const cascadeSuccess = await cascadeSubtaskCompletion(Number(taskId), isDone, currentTasks);
    return {success: true, cascadeSuccess};
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

function markTruncatedText(root = document) {
    const textElements = root.querySelectorAll('.task-title, .task-desc, .modal-subtask-label');
    textElements.forEach(el => {
        const isTruncated = el.scrollWidth > el.clientWidth;
        el.closest('.task-title-wrapper, .task-desc-wrapper, .modal-subtask-label-wrapper')
            .classList.toggle('has-tooltip', isTruncated);
    });
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

function resetFormErrors(form) {
    form.querySelectorAll('.input-wrapper.has-error').forEach(wrapper => {
        wrapper.classList.remove('has-error');
        wrapper.querySelector('.field-error-msg')?.remove();
    });
}

function showLoginPageSection(sectionId) {
    const currentSection = document.getElementById(sectionId);
    document.querySelectorAll('.login-page-element')
        .forEach(el => {
            el.style.display = 'none';
        });
    currentSection.style.display = 'flex';
    resetFormErrors(currentSection);
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

// TODO RECONSIDER MISSING TASKS TITLES OVERALL
function showMissingTasksMessage(heading = 'No tasks found', subtext = 'Try adjusting your filters or create a new task to get started.') {
    document.getElementById('no-tasks-heading').textContent = heading;
    document.getElementById('no-tasks-subtext').textContent = subtext;
    document.getElementById('no-tasks-message').style.display = 'flex';
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

const floatingTooltipShell = document.getElementById('floating-tooltip-shell');
const floatingTooltip = document.getElementById('floating-tooltip');
const floatingTooltipArrow = document.getElementById('floating-tooltip-arrow');

let tooltipTarget = null;
let hideTimeout = null;

function positionFloatingTooltip(textEl, axis = 'vertical') {
    if (!textEl) return;

    const rect = textEl.getBoundingClientRect();
    const margin = 4;
    const minSpace = 100;

    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceLeft = rect.left - margin;
    const spaceRight = window.innerWidth - rect.right - margin;

    let placement;
    if (axis === 'horizontal' && Math.max(spaceLeft, spaceRight) >= minSpace) {
        placement = spaceRight >= spaceLeft ? 'right' : 'left';
    } else {
        placement = spaceBelow >= spaceAbove ? 'below' : 'above';
    }

    floatingTooltipShell.style.maxWidth = '';
    floatingTooltipShell.style.maxHeight = '';

    if (placement === 'above' || placement === 'below') {
        const available = Math.max(80, placement === 'below' ? spaceBelow : spaceAbove);
        floatingTooltipShell.style.maxHeight = `${Math.min(available, window.innerHeight * 0.4)}px`;
    } else {
        const availableWidth = placement === 'right' ? spaceRight : spaceLeft;
        floatingTooltipShell.style.maxWidth = `${Math.min(Math.max(availableWidth, 120), 320)}px`;
        floatingTooltipShell.style.maxHeight = `${window.innerHeight * 0.4}px`;
    }

    const tipRect = floatingTooltipShell.getBoundingClientRect();

    let top, left;
    if (placement === 'below') {
        top = rect.bottom + margin;
        left = rect.left + (rect.width - tipRect.width) / 2;
    } else if (placement === 'above') {
        top = Math.max(margin, rect.top - tipRect.height - margin);
        left = rect.left + (rect.width - tipRect.width) / 2;
    } else if (placement === 'right') {
        left = rect.right + margin;
        top = rect.top + (rect.height - tipRect.height) / 2;
    } else if (placement === 'left') {
        left = Math.max(margin, rect.left - tipRect.width - margin);
        top = rect.top + (rect.height - tipRect.height) / 2;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - -tipRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - -tipRect.height - margin));

    floatingTooltipShell.style.top = `${top}px`;
    floatingTooltipShell.style.left = `${left}px`;

    const arrowSize = 8;
    const cornerInset = 6;
    let arrowLeft, arrowTop;

    if (placement === 'below' || placement === 'above') {
        arrowLeft = rect.left + rect.width / 2 - arrowSize / 2;
        arrowLeft = Math.max(left + cornerInset, Math.min(arrowLeft, left + tipRect.width - arrowSize - cornerInset));
        arrowTop = placement === 'below' ? top - arrowSize / 2 : top + tipRect.height - arrowSize / 2;
    } else {
        arrowTop = rect.top + rect.height / 2 - arrowSize / 2;
        arrowTop = Math.max(top + cornerInset, Math.min(arrowTop, top + tipRect.height - arrowSize - cornerInset));
        arrowLeft = placement === 'right' ? left - arrowSize / 2 : left + tipRect.width - arrowSize / 2;
    }

    floatingTooltipArrow.style.left = `${arrowLeft}px`;
    floatingTooltipArrow.style.top = `${arrowTop}px`;
}

function showFloatingTooltip(wrapper, textEl, text, axis) {
    clearTimeout(hideTimeout);
    tooltipTarget = wrapper;
    floatingTooltip.textContent = text;
    floatingTooltipShell.classList.add('visible');
    floatingTooltipArrow.classList.add('visible');
    positionFloatingTooltip(textEl, axis);
}

function hideFloatingTooltip() {
    tooltipTarget = null;
    floatingTooltipShell.classList.remove('visible');
    floatingTooltipArrow.classList.remove('visible');
}

function scheduleHide() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideFloatingTooltip, 120);
}

floatingTooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
floatingTooltip.addEventListener('mouseleave', scheduleHide);

function attachFloatingTooltips(container, wrapperSelector, textSelector, axis = 'vertical') {
    container.addEventListener('mouseover', (e) => {
        const wrapper = e.target.closest(`${wrapperSelector}.has-tooltip`);
        if (!wrapper || wrapper === tooltipTarget) return;

        const textEl = wrapper.querySelector(textSelector);
        if (!textEl) return;

        showFloatingTooltip(wrapper, textEl, textEl.textContent, axis);
    });

    container.addEventListener('mouseout', (e) => {
        const wrapper = e.target.closest(wrapperSelector);
        if (wrapper && (!e.relatedTarget || !wrapper.contains(e.relatedTarget))) {
            scheduleHide();
        }
    });

    container.addEventListener('scroll', () => {
        if (!tooltipTarget || !container.contains(tooltipTarget)) return;

        const textEl = tooltipTarget.querySelector(textSelector);
        if (!textEl) {
            hideFloatingTooltip();
            return;
        }

        positionFloatingTooltip(textEl, axis);
    }, true);
}

function getFieldErrorMessage(input) {
    if (input.validity.valueMissing) {
        return 'This field is required.';
    }
    if (input.validity.typeMismatch && input.type === 'email') {
        return 'Please enter a valid email address';
    }
    if (input.validity.tooShort) {
        return `Must be at least ${input.minLength} characters.`;
    }
    return input.validationMessage || 'Please check this field.';
}

function showFieldError(input) {
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;

    wrapper.classList.add('has-error');

    let errorEl = wrapper.querySelector('.field-error-msg');
    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'field-error-msg';
        errorEl.innerHTML = '<i data-lucide="circle-alert" class="field-error-icon"></i><span></span>';
        wrapper.appendChild(errorEl);
        lucide.createIcons();
    }

    errorEl.querySelector('span').textContent = getFieldErrorMessage(input);
}

function clearFieldError(input) {
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;

    wrapper.classList.remove('has-error');
    wrapper.querySelector('.field-error-msg')?.remove();
}

function initCustomValidation(form) {
    form.querySelectorAll('[required]').forEach(input => {
        input.addEventListener('invalid', (e) => {
            e.preventDefault();
            showFieldError(input);
        });
        input.addEventListener('input', () => {
            if (input.validity.valid) clearFieldError(input);
            else showFieldError(input);
        });
    });
}

function initPasswordVisibilityToggle(inputEl, showBtn, hideBtn) {
    let isPasswordVisible = false;

    showBtn.style.display = 'none';
    hideBtn.style.display = 'none';

    function update() {
        const inputFocused = document.activeElement === inputEl;
        showBtn.style.display = inputFocused && !isPasswordVisible ? 'flex' : 'none';
        hideBtn.style.display = inputFocused && isPasswordVisible ? 'flex' : 'none';
    }

    inputEl.addEventListener('focus', update);

    inputEl.addEventListener('blur', () => {
        showBtn.style.display = 'none';
        hideBtn.style.display = 'none';
    });

    showBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });

    hideBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });

    showBtn.addEventListener('click', () => {
        isPasswordVisible = true;
        inputEl.type = 'text';
        update();
    });

    hideBtn.addEventListener('click', () => {
        isPasswordVisible = false;
        inputEl.type = 'password';
        update();
    });
}

function initLoginLogic() {
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginForm = document.getElementById('login-form');
    const loginShowPasswordBtn = document.getElementById('login-show-password-btn');
    const loginHidePasswordBtn = document.getElementById('login-hide-password-btn');
    const invalidCredentialsMessage = document.getElementById('invalid-cred-msg');
    const showRegisterBtn = document.getElementById('show-register-btn');

    initCustomValidation(loginForm);
    initPasswordVisibilityToggle(loginPassword, loginShowPasswordBtn, loginHidePasswordBtn);

    loginEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginPassword.focus();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        invalidCredentialsMessage.style.display = 'none';
        loginEmail.classList.remove('has-error');
        loginPassword.classList.remove('has-error');

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
                loginEmail.classList.add('has-error');
                loginPassword.classList.add('has-error');
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
    const registerShowPasswordBtn = document.getElementById('register-show-password-btn');
    const registerHidePasswordBtn = document.getElementById('register-hide-password-btn');
    const confirmRegisterPassword = document.getElementById('confirm-register-password');
    const confirmShowPasswordBtn = document.getElementById('register-confirm-show-password-btn');
    const confirmHidePasswordBtn = document.getElementById('register-confirm-hide-password-btn');
    const registerForm = document.getElementById('register-form');
    const emailInUseMsg = document.getElementById('email-in-use-msg');
    const showLoginBtn = document.getElementById('show-login-btn');
    const passwordNotMatchingMsg = document.getElementById('password-not-matching-msg');

    initCustomValidation(registerForm);
    initPasswordVisibilityToggle(registerPassword, registerShowPasswordBtn, registerHidePasswordBtn);
    initPasswordVisibilityToggle(confirmRegisterPassword, confirmShowPasswordBtn, confirmHidePasswordBtn);

    function confirmRegisterPasswordsMatch() {
        const password = registerPassword.value;
        const confirm_password = confirmRegisterPassword.value;

        if (confirm_password !== password) {
            confirmRegisterPassword.classList.add('has-error');
            passwordNotMatchingMsg.style.display = 'flex';
            return false;
        } else {
            confirmRegisterPassword.classList.remove('has-error');
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
            confirmRegisterPassword.focus();
        }
    });

    confirmRegisterPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (confirmRegisterPasswordsMatch() === true)
                registerForm.requestSubmit();
        }
    });

    confirmRegisterPassword.addEventListener('blur', () => {
        confirmRegisterPasswordsMatch();
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        registerEmail.classList.remove('has-error');
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
                registerEmail.classList.add('has-error');
                emailInUseMsg.style.display = 'flex';
            } else {
                console.error('Unexpected server error');
            }
        } catch (error) {
            console.log('Register failed: ', error);
        }
    });

    showLoginBtn.addEventListener('click', (e) => {
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

function initTaskManagementLogic() {
    const tasksList = document.getElementById('tasks-list');
    const taskMenu = document.getElementById('task-menu');
    const newTaskBtn = document.getElementById('new-task-btn');

    let currentViewType = 'filter';
    let currentFilterId = 'all';
    let activeMenuTaskId = null;

    let tasksById = new Map();

    let expandedTaskIds = new Set();

    attachFloatingTooltips(tasksList, '.task-title-wrapper', '.task-title');
    attachFloatingTooltips(tasksList, '.task-desc-wrapper', '.task-desc');

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

    function renderTasks(tasksArray, tasksById) {
        document.getElementById('no-tasks-message').style.display = 'none';

        if (tasksArray.length === 0) {
            if (currentFilterId === 'completed') {
                showMissingTasksMessage(
                    'Nothing to see here',
                    'Your completed tasks will live here once you finish them.'
                )
            } else if (currentViewType === 'project') {
                showMissingTasksMessage(
                    'This project is empty',
                    'Create a new task to start filling out your project board.'
                )
            } else {
                showMissingTasksMessage();
            }
        }

        let allTasksHTML = '';

        for (const item of tasksArray) {
            if (item.isGhostRow) {
                allTasksHTML += `
                    <div class="task-item is-subtask ghost-row" data-depth="${item.depth}" data-parent-id="${item.parentId}">
                        <button type="button" class="ghost-add-btn">
                            <i data-lucide="plus" class="task-icon"></i>
                            Add subtask
                        </button>
                    </div>
                `;
                continue;
            }

            const task = item;
            let hasDescription = task.description !== null && task.description !== undefined && task.description !== '';
            const hasDueDate = task.due_date !== null && task.due_date !== undefined;

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

            const depth = getDepth(task, tasksById);
            const isExpanded = expandedTaskIds.has(task.id);

            const defaultDisplay = (depth > 0 && !task.forceVisible) ? 'style="display: none;"' : '';

            allTasksHTML += `
                <div class="task-item ${task.is_done ? "completed" : ''} ${isExpired(task) ? "expired-task" : ''} ${currentFilterId === "deleted" ? "task-item-locked" : ''} ${task.is_important ? "important" : ''} ${depth > 0 ? "is-subtask" : ''} ${item.isForcedAncestor ? "forced-ancestor" : ''}" data-id="${task.id}" data-depth="${depth}" ${defaultDisplay}>
                ${depth < MAX_SUBTASK_DEPTH
                ? `<button type="button" class="task-chevron ${isExpanded ? 'expanded' : ''}" id="task-chevron-${task.id}">
                        <i data-lucide="chevron-right" class="chevron-icon"></i>
                   </button>`
                : ''}
                    <input type="checkbox" class="task-checkbox" id="task-${task.id}" ${task.is_done ? "checked" : ''}>
                    <div class="task-body" id="body-${task.id}">
                        <span class="task-title-wrapper">
                            <span class="task-title">${task.title}</span>
                            <!-- <span class="tooltip-outer above">  
                                <span class="tooltip-bubble">${task.title}</span>
                            </span> -->
                        </span>
                        ${hasDescription ? `
                        <span class="task-desc-wrapper">
                            <span class="task-desc">${task.description}</span>
                            <!-- <span class="tooltip-outer below">
                                <span class="tooltip-bubble">${task.description}</span>
                            </span> -->
                        </span>
                        ` : ''}
                    </div>
                    <div class="task-meta">
                        ${hasDueDate ? hasDueDateHtml : hasNoDueDateHtml}
                        ${actionButtonHtml}
                    </div>
                </div>
            `;
        }

        const oldElements = tasksList.querySelectorAll('.task-item:not(.new-task-item), .breadcrumb-item');
        oldElements.forEach(task => task.remove());

        tasksList.insertAdjacentHTML('beforeend', allTasksHTML);

        tasksList.querySelectorAll('.task-item.is-subtask').forEach(el => {
            el.style.setProperty('--subtask-depth', el.dataset.depth);
        });

        expandedTaskIds.forEach(taskId => {
            const taskEl = tasksList.querySelector(`.task-item[data-id="${taskId}"]`);
            if (taskEl) {
                expandTask(taskEl);
            } else {
                expandedTaskIds.delete(taskId);
            }
        });

        requestAnimationFrame(() => {
            markTruncatedText(tasksList);
            lucide.createIcons();
        });
    }

    function updateSidebarCounts() {
        const counts = {today: 0, important: 0, expired: 0};

        for (const task of currentTasks) {
            if (filters.today(task)) counts.today++;
            if (filters.important(task)) counts.important++;
            if (filters.expired(task)) counts.expired++;
        }

        document.getElementById('today-tasks-counter').textContent = counts.today;
        document.getElementById('important-tasks-counter').textContent = counts.important;
        document.getElementById('expired-tasks-counter').textContent = counts.expired;
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

    function buildRenderOrder(tasks, tasksById) {
        const childrenByParent = new Map();
        const topLevel = [];
        const taskIds = new Set(tasks.map(t => t.id));

        for (const task of tasks) {
            const parentInSet = task.parent_id !== null && task.parent_id !== undefined && taskIds.has(task.parent_id);
            if (!parentInSet) {
                topLevel.push(task);
            } else {
                if (!childrenByParent.has(task.parent_id)) {
                    childrenByParent.set(task.parent_id, []);
                }
                childrenByParent.get(task.parent_id).push(task);
            }
        }

        function walk(taskList) {
            const ordered = [];
            for (const task of sortTasks(taskList)) {
                ordered.push(task);

                const children = childrenByParent.get(task.id);
                if (children) {
                    ordered.push(...walk(children));
                }

                const absoluteDepth = getDepth(task, tasksById);

                if (absoluteDepth < MAX_SUBTASK_DEPTH) {
                    ordered.push({
                        isGhostRow: true,
                        parentId: task.id,
                        depth: absoluteDepth + 1
                    });
                }
            }
            return ordered;
        }

        return walk(topLevel);
    }

    function computeVisibleTaskSet(allTasks, tasksById, filterId) {
        const predicate = filters[filterId];
        if (!predicate) {
            return new Map();
        }

        const isBaseVisible = (task) => {
            if (filterId !== 'deleted' && task.is_deleted) return false;
            if (filterId !== 'archived' && task.is_archived) return false;
            return true;
        };

        const childrenByParent = new Map();
        for (const task of allTasks) {
            if (task.parent_id !== null && task.parent_id !== undefined) {
                if (!childrenByParent.has(task.parent_id)) {
                    childrenByParent.set(task.parent_id, []);
                }
                childrenByParent.get(task.parent_id).push(task);
            }
        }

        const visible = new Map();

        const directMatches = allTasks.filter(predicate);
        for (const task of directMatches) {
            visible.set(task.id, {task, isDirectMatch: true, isForcedAncestor: false, forceVisible: false});
        }

        function pullDescendants(taskId) {
            const children = childrenByParent.get(taskId);
            if (!children) return;
            for (const child of children) {
                if (!isBaseVisible(child)) continue;
                if (!visible.get(child.id)) {
                    visible.set(child.id, {
                        task: child,
                        isDirectMatch: predicate(child),
                        isForcedAncestor: false,
                        forceVisible: false
                    });
                }
                pullDescendants(child.id);
            }
        }

        for (const task of directMatches) {
            pullDescendants(task.id);
        }

        for (const task of directMatches) {
            const chain = [task];
            let current = task;
            let needsForce = false;

            while (current.parent_id !== null && current.parent_id !== undefined) {
                const parent = tasksById.get(current.parent_id);
                if (!parent || !isBaseVisible(parent)) break;

                const parentEntry = visible.get(parent.id);

                if (parentEntry && !parentEntry.isForcedAncestor)
                    break;

                if (parentEntry && parentEntry.isForcedAncestor && parentEntry.forceVisible) {
                    needsForce = true;
                    break;
                }

                needsForce = true;
                if (!parentEntry) {
                    visible.set(parent.id, {
                        task: parent,
                        isDirectMatch: predicate(parent),
                        isForcedAncestor: true,
                        forceVisible: false
                    });
                }
                chain.push(parent);
                current = parent;
            }

            if (needsForce) {
                for (const t of chain) {
                    visible.get(t.id).forceVisible = true;
                }
            }
        }

        return visible;
    }

    function refreshUI() {
        tasksById = new Map(currentTasks.map(task => [task.id, task]));

        const visibleSet = computeVisibleTaskSet(currentTasks, tasksById, currentFilterId);
        const visibleTasks = Array.from(visibleSet.values()).map(entry => ({
            ...entry.task,
            isForcedAncestor: entry.isForcedAncestor,
            forceVisible: entry.forceVisible,
        }));

        const orderedTasks = buildRenderOrder(visibleTasks, tasksById);
        renderTasks(orderedTasks, tasksById);
    }

    function getDescendantRows(taskEl) {
        const depth = Number(taskEl.dataset.depth);
        const descendants = [];
        let sibling = taskEl.nextElementSibling;

        while (sibling && sibling.classList.contains('task-item')) {
            const siblingDepth = Number(sibling.dataset.depth);
            if (siblingDepth <= depth) break;
            descendants.push(sibling);
            sibling = sibling.nextElementSibling;
        }

        return descendants;
    }

    document.addEventListener('app:authSuccess', async () => {
        currentTasks = await fetchUserTasks();
        refreshUI();
        updateSidebarCounts();
    });

    document.addEventListener('app:itemCreated', (e) => {
        currentTasks.push(e.detail);
        refreshUI();
        updateSidebarCounts();
    });

    document.addEventListener('app:sidebarChanged', (e) => {
        expandedTaskIds = new Set();
        currentViewType = e.detail.viewType;
        currentFilterId = e.detail.filterId;
        refreshUI();
        tasksList.scrollTop = tasksList.top;
    });

    function collapseTask(taskEl) {
        const descendants = getDescendantRows(taskEl);

        descendants.forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('collapsing');
            }, index * 20);
        });

        const lastDelay = (descendants.length - 1) * 40;
        setTimeout(() => {
            descendants.forEach(el => {
                el.style.display = 'none';
                el.classList.remove('collapsing');
            });
        }, lastDelay + 40);
    }

    function expandTask(taskEl) {
        const depth = Number(taskEl.dataset.depth);
        let sibling = taskEl.nextElementSibling;

        let skipDeeperThan = 9999;

        while (sibling && sibling.classList.contains('task-item')) {
            const siblingDepth = Number(sibling.dataset.depth);

            if (siblingDepth <= depth) break;

            if (siblingDepth > skipDeeperThan) {
                sibling = sibling.nextElementSibling;
                continue;
            }

            sibling.style.display = 'flex';
            requestAnimationFrame(() => {
                sibling.classList.remove('collapsing');
            });

            const siblingId = Number(sibling.getAttribute('data-id'));
            if (!expandedTaskIds.has(siblingId)) {
                skipDeeperThan = siblingDepth;
            } else {
                skipDeeperThan = 9999;
            }

            sibling = sibling.nextElementSibling;
        }
    }

    tasksList.addEventListener('click', async (e) => {
        const clickedItem = e.target.closest('.task-item');
        const clickedChevron = e.target.closest('.task-chevron');
        const clickedCheckbox = e.target.closest('.task-checkbox');
        const clickedDateTime = e.target.closest('.due-date-wrapper');
        const clickedMenuBtn = e.target.closest('.task-menu-btn');
        const clickedRestore = e.target.closest('.task-restore-btn');
        const clickedGhostBtn = e.target.closest('.ghost-add-btn');

        if (clickedChevron) {
            const taskItemElement = clickedChevron.closest('.task-item');
            const taskId = Number(taskItemElement.getAttribute('data-id'));
            const isExpanded = clickedChevron.classList.contains('expanded');

            if (isExpanded) {
                collapseTask(taskItemElement);
                clickedChevron.classList.remove('expanded');
                clickedChevron.classList.add('collapsed');
                expandedTaskIds.delete(taskId);
            } else {
                expandTask(taskItemElement);
                clickedChevron.classList.add('expanded');
                clickedChevron.classList.remove('collapsed');
                expandedTaskIds.add(taskId);
            }
        }

        if (clickedCheckbox) {
            const taskItemElement = clickedCheckbox.closest('.task-item');
            const taskId = taskItemElement.getAttribute('data-id');
            const isCompleted = clickedCheckbox.checked;

            const {success, cascadeSuccess} = await completeTaskWithCascade(taskId, isCompleted);

            if (success) {
                if (!cascadeSuccess) showErrorToast('Some subtasks could not be updated.');
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

        if (clickedGhostBtn) {
            const ghostRow = clickedGhostBtn.closest('.ghost-row');
            const parentId = Number(ghostRow.dataset.parentId);
            const depth = Number(ghostRow.dataset.depth);

            const inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'ghost-add-input';
            inputEl.placeholder = 'Subtask title';
            inputEl.maxLength = 255;

            ghostRow.classList.add('ghost-row-input');
            clickedGhostBtn.replaceWith(inputEl);
            inputEl.focus();

            let isProcessing = false;

            async function commit() {
                const title = inputEl.value.trim();

                if (title === '') {
                    inputEl.replaceWith(clickedGhostBtn);
                    ghostRow.classList.remove('ghost-row-input');
                    return;
                }

                const result = await createTaskRequest({title: title, parent_id: parentId});

                if (result.success) {
                    currentTasks.push(result.task);
                    expandedTaskIds.add(parentId);
                    refreshUI();

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const newGhostBtn = tasksList.querySelector(
                                `.ghost-row[data-parent-id="${parentId}"] .ghost-add-btn`
                            );
                            if (newGhostBtn) {
                                newGhostBtn.click();
                            }
                        });
                    });
                } else {
                    showErrorToast('Something went wrong. Please try again.');
                    inputEl.replaceWith(clickedGhostBtn);
                }

                ghostRow.classList.remove('ghost-row-input');
            }

            inputEl.addEventListener('keydown', async (e) => {
                if (e.key === 'Escape') {
                    isProcessing = true;
                    inputEl.replaceWith(clickedGhostBtn);
                    ghostRow.classList.remove('ghost-row-input');
                }
                if (e.key === 'Enter') {
                    if (isProcessing) return;
                    isProcessing = true;
                    await commit();
                }
            });

            inputEl.addEventListener('blur', async () => {
                if (isProcessing) return;
                isProcessing = true;
                await commit();
            });
        }

        const hasSpecificAction = clickedChevron || clickedCheckbox || clickedDateTime || clickedMenuBtn || clickedRestore || clickedGhostBtn;

        if (!hasSpecificAction && clickedItem && !clickedItem.classList.contains('new-task-item')) {
            if (clickedItem.classList.contains('forced-ancestor')) {
                return;
            }

            const taskId = clickedItem.getAttribute('data-id');
            const targetTask = currentTasks.find(task => task.id === Number(taskId));
            const taskDepth = getDepth(targetTask, tasksById);

            if (targetTask) {
                document.dispatchEvent(new CustomEvent('app:openTaskModal', {
                    detail: {
                        task: targetTask,
                        depth: taskDepth,
                    },
                }));
            }
        }
    });

    newTaskBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('app:openTaskModal', {
            detail: null
        }));
    });

    function openMenu(triggerBtn, taskId) {
        try {
            const targetTask = currentTasks.find(task => task.id === Number(taskId));

            const importantIcon = targetTask.is_important ? 'star-off' : 'star';
            document.getElementById('menu-important-icon').outerHTML =
                `<i data-lucide="${importantIcon}" class="task-icon" id="menu-important-icon"></i>`;
            document.getElementById('menu-important-label').textContent =
                targetTask.is_important ? 'Remove Importance' : 'Mark Important';

            const archiveIcon = targetTask.is_archived ? 'archive-restore' : 'archive';
            document.getElementById('menu-archive-icon').outerHTML =
                `<i data-lucide="${archiveIcon}" class="task-icon" id="menu-archive-icon"></i>`;
            document.getElementById('menu-archive-label').textContent =
                targetTask.is_archived ? 'Unarchive' : 'Archive';

            lucide.createIcons();

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
        } catch (error) {
            showErrorToast('Something went wrong. Please try again.');
            console.log('openMenu failed:' + error);
        }
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

        const path = e.composedPath();
        const clickedInsideMenuOrBtn = path.some(el =>
            el.classList && (el.classList.contains('task-menu') || el.classList.contains('task-menu-btn'))
        );

        if (!clickedInsideMenuOrBtn) {
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
        updateSidebarCounts();
    });
}

function initTaskModalLogic() {
    const taskDetailsModal = document.getElementById('task-details-modal');

    const modalBackBtn = document.getElementById('modal-back-btn');
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
    let ancestorIds = [];
    let currentTaskDepth = 0;
    let nestingLimitNotReached = true;
    let noSubtasksDefaultMessageActive = false;

    const noSubtasksDefaultMessage = `
        <li class="modal-subtasks-item no-subtasks-msg" id="no-subtasks-msg">
            <i data-lucide="list-plus" class="no-subtasks-icon"></i>
            <span class="no-subtasks-heading">
                You haven't added any subtasks yet
            </span>
            <span class="no-subtasks-subtext">
                Click the [+] button above to add your first subtask
            </span>
        </li>
    `;

    const nestingLimitReachedMessage = `
        <li class="modal-subtasks-item no-subtasks-msg" id="no-subtasks-msg">
            <i data-lucide="info" class="no-subtasks-icon"></i>
            <span class="no-subtasks-heading">
                Maximum nesting limit reached
            </span>
            <span class="no-subtasks-subtext">
                Tasks can only be nested up to ${MAX_SUBTASK_DEPTH + 1} levels deep
            </span>
        </li>
    `

    attachFloatingTooltips(modalSubtasksList, '.modal-subtask-label-wrapper', '.modal-subtask-label', 'horizontal');

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
            if (Object.prototype.hasOwnProperty.call(payloadObject, 'is_done')) {
                const cascadeSuccess = await cascadeSubtaskCompletion(currentTask.id, payloadObject.is_done, currentTasks);
                if (!cascadeSuccess) {
                    showErrorToast('Some subtasks could not be updated.');
                }
            }
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

        document.dispatchEvent(new CustomEvent('app:taskUpdated'));
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

            if (ancestorIds.length === 0)
                closeModal();
            else
                modalBackBtn.click();
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

    function getSubtasksCount() {
        const childrenByParent = new Map();
        for (const task of currentTasks) {
            if (task.parent_id !== null && task.parent_id !== undefined && !task.is_deleted) {
                if (!childrenByParent.has(task.parent_id)) {
                    childrenByParent.set(task.parent_id, []);
                }
                childrenByParent.get(task.parent_id).push(task);
            }
        }

        let all = 0, completed = 0;

        function walk(id) {
            const children = childrenByParent.get(id);
            if (!children) return;
            for (const child of children) {
                all++;
                if (child.is_done) completed++;
                walk(child.id);
            }
        }

        walk(currentTask.id);

        const directSubtasks = childrenByParent.get(currentTask.id);

        return {directSubtasks, all, completed};
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

        const {directSubtasks: subtasks, all: allSubtasks, completed: completedSubtasks} = getSubtasksCount();
        modalCompletedSubtasksCounter.textContent = completedSubtasks + '/' + allSubtasks + ' Completed';

        modalCompletedSubtasksCounter.style.display = nestingLimitNotReached ? 'inline-flex' : 'none';

        const oldElements = modalSubtasksList.querySelectorAll('.modal-subtasks-item');
        oldElements.forEach(subtask => subtask.remove());

        let modalSubtasksHTML = '';

        if (allSubtasks === 0) {
            noSubtasksDefaultMessageActive = true;
            modalSubtasksHTML += nestingLimitNotReached ? noSubtasksDefaultMessage : nestingLimitReachedMessage;
        }

        if (subtasks) {
            noSubtasksDefaultMessageActive = false;
            for (const subtask of subtasks) {
                modalSubtasksHTML += `
                <li class="modal-subtasks-item ${subtask.is_done ? 'completed' : ''} ${isExpired(subtask) ? 'expired' : ''}" id="modal-subtask-${subtask.id}" data-modal-subtask-id="${subtask.id}">
                        <input type="checkbox" class="modal-subtask-checkbox" ${subtask.is_done ? 'checked' : ''}>
                        <span class="modal-subtask-label-wrapper">
                            <span class="modal-subtask-label">${subtask.title}</span>
                        </span>
                </li>
            `;
            }
        }

        modalSubtasksList.insertAdjacentHTML('beforeend', modalSubtasksHTML);

        requestAnimationFrame(() => {
            markTruncatedText(modalSubtasksList);
        });
    }

    document.addEventListener('app:openTaskModal', (e) => {
        hideFloatingTooltip();
        activeEdit = false;
        suppressBackdropClose = false;

        currentTaskDepth = 0;
        nestingLimitNotReached = true;

        const detail = e.detail;
        const isWrapped = detail && typeof detail === 'object' && 'task' in detail;
        const task = isWrapped ? detail.task : null;

        ancestorIds = isWrapped && detail.ancestorIds ? detail.ancestorIds : [];
        currentTask = task ?? {title: '', description: null, due_date: null, is_important: null, is_archived: null};
        isCreatingTask = task === null || task === undefined;
        if (detail && detail.depth !== null && detail.depth !== undefined) {
            currentTaskDepth = detail.depth;
            nestingLimitNotReached = currentTaskDepth < MAX_SUBTASK_DEPTH;
        }

        modalBackBtn.style.display = ancestorIds.length > 0 ? 'flex' : 'none';
        modalTitleText.classList.remove('modal-unset-title', 'modal-missing-title-error');
        modalMissingTitleMsg.style.display = 'none';
        taskDetailsModal.classList.remove('hiding');
        taskDetailsModal.style.display = 'flex';
        modalDueDateControl.classList.remove('modal-widget-unset-value');
        modalDueDateControl.classList.remove('task-overdue');
        modalAddSubtaskBtn.style.display = currentTaskDepth < MAX_SUBTASK_DEPTH ? 'flex' : 'none';

        if (isCreatingTask) {
            modalImportantBtn.classList.remove('active');
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

            modalProjectControl.classList.add('modal-widget-unset-value');
            modalProjectText.classList.add('modal-unset-value-text');
            modalProjectText.textContent = 'Move to Project...';

            modalSubtasksList.innerHTML = '';
            modalSubtasksList.insertAdjacentHTML('beforeend', nestingLimitNotReached ? noSubtasksDefaultMessage : nestingLimitReachedMessage);
            noSubtasksDefaultMessageActive = true;

            lucide.createIcons();
            // TODO SUBTASKS CREATION

            modalTitleText.click();
        } else {
            document.getElementById('modal-complete-btn-text').textContent = currentTask.is_done ? 'Mark Incomplete' : 'Mark Complete';
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
        if (isCreatingTask)
            modalCompletedSubtasksCounter.style.display = 'none';
        modalArchiveBtn.style.display = isCreatingTask ? 'none' : 'flex';
        modalDeleteBtn.style.display = isCreatingTask ? 'none' : 'flex';
        modalCreateTaskBtn.style.display = isCreatingTask ? 'flex' : 'none';
        modalCancelBtn.style.display = isCreatingTask ? 'flex' : 'none';
    });

    modalBackBtn.addEventListener('click', () => {
        if (ancestorIds.length === 0) return;

        const parentId = ancestorIds[ancestorIds.length - 1];
        const parentTask = currentTasks.find(task => task.id === parentId);
        if (!parentTask) return;

        document.dispatchEvent(new CustomEvent('app:openTaskModal', {
            detail: {
                task: parentTask,
                ancestorIds: ancestorIds.slice(0, -1),
                depth: currentTaskDepth - 1,
            },
        }));
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

    function autoResize(textAreaElement) {
        textAreaElement.style.height = 'auto';
        textAreaElement.style.height = textAreaElement.scrollHeight + 'px';
    }

    modalTitleText.addEventListener('click', () => {
        if (activeEdit) return;
        activeEdit = true;
        modalImportantBtn.style.display = 'none';

        const originalText = currentTask.title;

        const textAreaElement = document.createElement('textarea');
        textAreaElement.value = originalText;
        textAreaElement.className = 'modal-task-title edit-textarea edit-title-textarea';
        textAreaElement.placeholder = 'Task Title'
        textAreaElement.maxLength = 255;
        textAreaElement.rows = 1;

        modalTitleText.replaceWith(textAreaElement);

        autoResize(textAreaElement);
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

        autoResize(textAreaElement);
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

    function addSubtaskInputRow() {
        const li = document.createElement('li');
        li.className = 'modal-subtasks-item new-subtask-item';

        const textAreaElement = document.createElement('textarea');
        textAreaElement.className = 'modal-subtask-input edit-textarea';
        textAreaElement.placeholder = 'Subtask title';
        textAreaElement.maxLength = 255;
        textAreaElement.rows = 1;

        li.appendChild(textAreaElement);
        modalSubtasksList.appendChild(li);

        autoResize(textAreaElement);
        modalSubtasksList.scrollTop = modalSubtasksList.scrollHeight;

        textAreaElement.addEventListener('input', () => {
            autoResize(textAreaElement);
            modalSubtasksList.scrollTop = modalSubtasksList.scrollHeight;
        });

        activeEdit = true;
        textAreaElement.focus();

        let isProcessing = false;

        async function commit() {
            const title = textAreaElement.value.trim();

            if (title === '') {
                li.remove();
                activeEdit = false;
                if (noSubtasksDefaultMessageActive)
                    document.getElementById('no-subtasks-msg').style.display = 'flex';
                return;
            }

            const result = await createTaskRequest({title: title, parent_id: currentTask.id});

            if (result.success) {
                document.dispatchEvent(new CustomEvent('app:itemCreated', {detail: result.task}));
                li.remove();
                refreshModalVisual();
                addSubtaskInputRow();
            } else {
                showErrorToast('Something went wrong. Please try again.');
                li.remove();
                activeEdit = false;
            }
        }

        textAreaElement.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape') {
                if (isProcessing) return;
                isProcessing = true;
                li.remove();
                setTimeout(() => {
                    activeEdit = false;
                }, 0);
                if (noSubtasksDefaultMessageActive)
                    document.getElementById('no-subtasks-msg').style.display = 'flex';
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
    }

    modalAddSubtaskBtn.addEventListener('click', () => {
        if (isCreatingTask || !currentTask.id) {
            showErrorToast('Save this task before adding subtasks.');
            return;
        }

        if (modalSubtasksList.querySelector('.new-subtask-item')) {
            modalSubtasksList.querySelector('.new-subtask-item').focus();
            return;
        }

        if (noSubtasksDefaultMessageActive)
            document.getElementById('no-subtasks-msg').style.display = 'none';

        addSubtaskInputRow();
    });

    modalSubtasksList.addEventListener('click', async (e) => {
        if (e.target.closest('.modal-subtask-label')) {
            hideFloatingTooltip();
        }

        const clickedCheckbox = e.target.closest('.modal-subtask-checkbox');
        const clickedLabel = e.target.closest('.modal-subtask-label');

        if (clickedCheckbox) {
            const subtaskElement = clickedCheckbox.closest('.modal-subtasks-item');
            const subtaskId = subtaskElement.getAttribute('data-modal-subtask-id');
            const isCompleted = clickedCheckbox.checked;

            const {success, cascadeSuccess} = await completeTaskWithCascade(subtaskId, isCompleted);

            if (success) {
                if (!cascadeSuccess) showErrorToast('Some subtasks could not be updated.');
                refreshModalVisual();
            } else {
                showErrorToast('Something went wrong. Please try again.');
                clickedCheckbox.checked = !isCompleted;
            }
        }

        if (clickedLabel) {
            const subtaskElement = clickedLabel.closest('.modal-subtasks-item');
            const subtaskId = subtaskElement.getAttribute('data-modal-subtask-id');
            const subtaskTask = currentTasks.find(task => task.id === Number(subtaskId));
            if (!subtaskTask) return;

            document.dispatchEvent(new CustomEvent('app:openTaskModal', {
                detail: {
                    task: subtaskTask,
                    ancestorIds: [...ancestorIds, currentTask.id],
                    depth: currentTaskDepth + 1,
                },
            }));
        }
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

        const viewType = clickedBtn.dataset.type;
        const clickedBtnId = clickedBtn.id;
        const filterId = clickedBtnId.split('-').pop();

        document.dispatchEvent(new CustomEvent('app:sidebarChanged', {
            detail: {
                viewType: viewType,
                filterId: filterId
            }
        }));
    });
}

function initPageHeaderLogic() {
    document.addEventListener('app:sidebarChanged', (e) => {
        const filterId = e.detail.filterId;
        document.getElementById('curr-title').textContent = pageTitles[filterId] || `${filterId[0].toUpperCase() + filterId.slice(1)} Tasks`;
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
    initTaskManagementLogic();
    initTaskModalLogic();
    initSidebarLogic();
    initPageHeaderLogic();

    await fetchAndRenderUser();
});

// TODO REMOVE BETA TESTING
// TODO DELETE
// document.getElementById('task-details-modal').style.display = 'flex';