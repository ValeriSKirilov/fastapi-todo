from app.models.item import Item
from app.models.user import User


def get_tokens(anon_client, user):
    response = anon_client.post("/auth/login", data={"username": "test@test.com", "password": "x"})
    return response.json()


def test_register_new_user(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "a@test.com", "password": "strongPass1", "first_name": "Test",
                                      "last_name": "User"})
    assert response.status_code == 201


def test_register_duplicate_user(anon_client, user):
    response = anon_client.post("/users/register",
                                json={"email": "test@test.com", "password": "validPass123",
                                      "first_name": "Test", "last_name": "User"})
    assert response.status_code == 409


def test_register_email_too_long(anon_client):
    long_email = "a@a.aa" + "a" * 250
    response = anon_client.post("/users/register",
                                json={"email": long_email, "password": "validPass123", "first_name": "Test",
                                      "last_name": "User"})
    assert response.status_code == 422


def test_register_invalid_email_format(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "john:.. ;doe.@.<gma[(il)].\"c\">", "password": "validPass123",
                                      "first_name": "Test", "last_name": "User"})
    assert response.status_code == 422


def test_register_first_name_too_long(anon_client):
    long_first_name = "a" * 256
    response = anon_client.post("/users/register",
                                json={"email": "longFirstName@test.com", "password": "validPass123",
                                      "first_name": long_first_name, "last_name": "User"})
    assert response.status_code == 422


def test_register_last_name_too_long(anon_client):
    long_last_name = "a" * 256
    response = anon_client.post("/users/register",
                                json={"email": "longLastName@test.com", "password": "validPass123",
                                      "first_name": long_last_name, "last_name": "User"})
    assert response.status_code == 422


def test_register_password_too_short(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "shortPass@test.com", "password": "1", "first_name": "Test",
                                      "last_name": "User"})
    assert response.status_code == 422


def test_register_password_too_long(anon_client):
    long_pass = "a" * 72 + "1"
    response = anon_client.post("/users/register",
                                json={"email": "longPass@test.com", "password": long_pass, "first_name": "Test",
                                      "last_name": "User"})
    assert response.status_code == 422


def test_register_password_too_long_cyrillic(anon_client):
    long_pass = "я" * 37 + "1"
    response = anon_client.post("/users/register",
                                json={"email": "longPassCyr@test.com", "password": long_pass, "first_name": "Test",
                                      "last_name": "User"})
    assert response.status_code == 422


def test_register_invalid_password_format(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "invalidPasswordFormat@test.com", "password": "aaaaaaaaaa",
                                      "first_name": "Test", "last_name": "User"})
    assert response.status_code == 422


def test_register_password_too_common(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "passwordTooCommon@test.com", "password": "password1",
                                      "first_name": "Test",
                                      "last_name": "User"})
    assert response.status_code == 422


def test_register_password_contains_personal_info(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "passwordContainsPersonalInfo@test.com", "password": "Test1234",
                                      "first_name": "Test", "last_name": "User"})
    assert response.status_code == 422


def test_register_empty_names_rejected(anon_client):
    response = anon_client.post("/users/register",
                                json={"email": "      ", "password": "strongPassword1",
                                      "first_name": "      ", "last_name": "       "})
    assert response.status_code == 422


def test_validate_password_success(anon_client):
    response = anon_client.post("/users/validate-password",
                                json={"password": "validPassword1", "email": "test@test.com",
                                      "first_name": "Test", "last_name": "User"})
    assert response.status_code == 200
    assert response.json()["status"] == "valid"


def test_validate_password_weak_rejected(anon_client):
    response = anon_client.post("/users/validate-password", json={"password": "password"})
    assert response.status_code == 400
    assert "code" in response.json()["detail"]
    assert response.json()["detail"]["code"] == "validation.error.password_weak"
    assert "message" in response.json()["detail"]
    assert response.json()["detail"]["message"] == "Use at least one letter and one number"


def test_validate_password_contains_personal_info_rejected(anon_client):
    response = anon_client.post("/users/validate-password",
                                json={"password": "testPass1", "email": "test@test.com",
                                      "first_name": "Test", "last_name": "User"})
    assert response.status_code == 400
    assert "code" in response.json()["detail"]
    assert response.json()["detail"]["code"] == "validation.error.password_personal"
    assert "message" in response.json()["detail"]
    assert response.json()["detail"]["message"] == "Your password can't contain your name or email"


def test_correct_login(anon_client, user):
    response = anon_client.post("/auth/login", data={"username": "test@test.com", "password": "x"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "token_type" in response.json()
    assert "refresh_token" in response.json()


def test_login_with_wrong_password(anon_client, user):
    response = anon_client.post("/auth/login", data={"username": "test@test.com", "password": "123"})
    assert response.status_code == 401


def test_login_with_nonexistent_email(anon_client):
    response = anon_client.post("/auth/login", data={"username": "a@a.com", "password": "password123"})
    assert response.status_code == 401


def test_me_with_valid_token(anon_client, user):
    login_response = get_tokens(anon_client, user)
    token = login_response["access_token"]

    response = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_me_with_no_token(anon_client):
    response = anon_client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token(anon_client, user):
    response = anon_client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken123"})
    assert response.status_code == 401


def test_change_password_success(client):
    response = client.put("/users/password", json={"current_password": "x", "new_password": "newStrongPass1"})
    assert response.status_code == 202


def test_change_password_incorrect_current_password(client):
    response = client.put("/users/password",
                          json={"current_password": "incorrectPassword", "new_password": "newStrongPass1"})
    assert response.status_code == 401


def test_change_password_weak_new_password(client):
    response = client.put("/users/password",
                          json={"current_password": "x", "new_password": "password1"})
    assert response.status_code == 400
    assert "code" in response.json()["detail"]
    assert response.json()["detail"]["code"] == "validation.error.password_common"
    assert "message" in response.json()["detail"]
    assert response.json()["detail"]["message"] == "This password is too common"


def test_refresh_with_valid_token(anon_client, user):
    login_response = get_tokens(anon_client, user)
    refresh_token = login_response["refresh_token"]

    response = anon_client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_refresh_with_access_token(anon_client, user):
    login_response = get_tokens(anon_client, user)
    access_token = login_response["access_token"]

    response = anon_client.post("/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == 401


def test_refresh_with_invalid_token(anon_client, user):
    response = anon_client.post("/auth/refresh", json={"refresh_token": "invalid"})
    assert response.status_code == 401


def test_logout(client, user):
    response = client.post("/auth/logout")
    assert response.status_code == 200


def test_delete_me_success(client):
    response = client.delete("/users/me")
    assert response.status_code == 204
