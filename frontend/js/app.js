import {API_BASE_URL} from "./config.js";

lucide.createIcons();

// GLOBAL VARIABLES

const login_section = document.getElementById("login-section");
const register_section = document.getElementById("register-section");
const success_section = document.getElementById("success-section");

let redirectTimer;

// GENERAL

document.addEventListener("DOMContentLoaded", async () => { // TODO UNCOMMENT
    await fetchAndRenderUser()
})

function switchView(targetID) {
    const pages = document.querySelectorAll('.app-view');
    for (const page of pages) {
        page.style.display = 'none';
    }

    const to_show = document.getElementById(targetID);
    if (to_show) {
        to_show.style.display = 'flex';
    } else {
        console.error("View not found: " + targetID);
    }
}

function showLoginForm() {
    const login_page_elements = document.querySelectorAll('.login-page-element');
    for (const login_page_element of login_page_elements) {
        login_page_element.style.display = 'none';
    }

    if (login_section) {
        login_section.style.display = 'flex';
    } else {
        console.error("View not found: " + login_section);
    }
}

function showRegisterForm() {
    const login_page_elements = document.querySelectorAll('.login-page-element');
    for (const el of login_page_elements) {
        el.style.display = 'none';
    }

    if (register_section) {
        register_section.style.display = 'flex';
    } else {
        console.error("View not found: " + register_section);
    }
}

function showSuccessBanner() {
    const login_page_elements = document.querySelectorAll('.login-page-element');
    for (const login_page_element of login_page_elements) {
        login_page_element.style.display = 'none';
    }

    if (success_section) {
        success_section.style.display = 'flex';
    } else {
        console.error("View not found: " + success_section);
    }
}

function confirmRegisterPassword() {
    const password = register_password.value;
    const confirm_password = confirm_register_password.value;
    const password_not_matching_img = document.getElementById("password-not-matching-icon");
    const password_not_matching_msg = document.getElementById('password-not-matching-msg');

    if (confirm_password !== password) {
        confirm_register_password.classList.add('input-error');
        password_not_matching_img.style.display = 'flex';
        password_not_matching_msg.style.display = 'flex';
        return false;
    } else {
        confirm_register_password.classList.remove('input-error');
        password_not_matching_img.style.display = 'none';
        password_not_matching_msg.style.display = 'none';
        return true;
    }
}

function renderUserProfile(userData) {
    const first_name = userData.first_name;
    const last_name = userData.last_name;

    const icon_initials = first_name[0].toUpperCase() + last_name[0].toUpperCase();
    const display_name = first_name + ' ' + last_name;

    const user_avatar = document.getElementById('user-avatar');
    const user_name = document.getElementById('user-name');

    user_avatar.textContent = icon_initials;
    user_name.textContent = display_name;
}

async function fetchAndRenderUser() {
    const token = localStorage.getItem('access_token');

    if (token) {
        try {
            const response = await fetch(API_BASE_URL + '/auth/me', {
                headers: {'Authorization': `Bearer ${token}`}
            });

            if (response.ok) {
                const userData = await response.json();
                renderUserProfile(userData);
                switchView('todo-page');
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

// LOGIN PAGE

const login_email = document.getElementById("login-email");
const login_password = document.getElementById("login-password");
login_email.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        login_password.focus();
    }
})

const login_form = document.getElementById("login-form");
login_form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(login_form);
    const data = new URLSearchParams(formData);

    try {
        const response = await fetch(API_BASE_URL + "/auth/login", {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: data
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('access_token', result.access_token);
            localStorage.setItem('refresh_token', result.refresh_token);
            await fetchAndRenderUser();
        } else {
            const invalid_credentials_message = document.getElementById('invalid-cred-msg');
            invalid_credentials_message.style.display = 'flex';

            login_email.classList.add('input-error');
            login_password.classList.add('input-error');
        }
    } catch (error) {
        console.log('Login failed:', error);
    }
})

const show_register_btn = document.getElementById("show-register-btn");
show_register_btn.addEventListener("click", (e) => {
    e.preventDefault();
    showRegisterForm();
})

// REGISTER PAGE

const register_first_name = document.getElementById("register-first-name");
const register_last_name = document.getElementById("register-last-name");
const register_email = document.getElementById("register-email");
const register_password = document.getElementById("register-password");
const confirm_register_password = document.getElementById("confirm-register-password");
register_first_name.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        register_last_name.focus();
    }
})
register_last_name.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        register_email.focus();
    }
})
register_email.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        register_password.focus();
    }
})
register_password.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        confirm_register_password.focus();
    }
})
confirm_register_password.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        if (confirmRegisterPassword() === true)
            register_form.requestSubmit();
    }
})
confirm_register_password.addEventListener("blur", (e) => {
    confirmRegisterPassword();
})

const register_form = document.getElementById("register-form");
register_form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(register_form);

    const password = formData.get('password');
    const confirm_password = formData.get('confirm-register-password');

    if (password !== confirm_password) {
        return;
    }

    formData.delete('confirm-register-password');

    const dataObject = Object.fromEntries(formData.entries());

    const data = JSON.stringify(dataObject);

    try {
        const response = await fetch(API_BASE_URL + "/users/register", {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: data
        });

        if (response.ok) {
            showSuccessBanner();
            redirectTimer = setTimeout(() => {
                showLoginForm();
            }, 2000);
        } else if (response.status === 409) {
            register_email.classList.add('input-error');
            const email_in_use_icon = document.getElementById('email-in-use-icon');
            email_in_use_icon.style.display = 'flex';
            const email_in_use_msg = document.getElementById('email-in-use-msg');
            email_in_use_msg.style.display = 'flex';
        } else {
            console.error("Unexpected server error");
        }
    } catch (error) {
        console.log('Register failed: ', error);
    }
})

const show_login_btn = document.getElementById("show-login-btn");
show_login_btn.addEventListener("click", (e) => {
    e.preventDefault();
    showLoginForm();
})

// SUCCESS PAGE

const redirect_to_login = document.getElementById("redirect-to-login");
redirect_to_login.addEventListener("click", (e) => {
    e.preventDefault();
    clearTimeout(redirectTimer);
    showLoginForm();
})

// LOGOUT CONFIG

const logout_btn = document.getElementById("logout-btn");
logout_btn.addEventListener("click", (e) => {
    e.preventDefault();

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    const tasks_list = document.getElementById('tasks-list');
    tasks_list.innerHTML = '';

    switchView('login-page');
})

// NEW TASK

const new_task_date = document.getElementById("new-task-date");
new_task_date.addEventListener("click", (e) => {
    try {
        if ('showPicker' in HTMLInputElement.prototype) {
            new_task_date.showPicker();
        }
    } catch (error) {
        console.log('Date picker failed: ', error);
    }
})
new_task_date.addEventListener("change", (e) => {
    const data = e.target.value;
    const due_date_text = document.getElementById('due-date-text');
    due_date_text.textContent = data;
})

const new_task_time = document.getElementById("new-task-time");
new_task_time.addEventListener("click", (e) => {
    try {
        if ('showPicker' in HTMLInputElement.prototype) {
            new_task_time.showPicker();
        }
    } catch (error) {
        console.log('Time picker failed: ', error);
    }
})
new_task_time.addEventListener("change", (e) => {
    const data = e.target.value;
    const due_time_text = document.getElementById('due-time-text');
    due_time_text.textContent = data;
})