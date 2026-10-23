import sqlalchemy as sa

from app.models.item import Item
from app.models.user import User
from app.models.project import Project


def test_foreign_keys_pragma_is_active(db, sqlite_only):
    result = db.execute(sa.text("PRAGMA foreign_keys")).scalar()
    assert result == 1


def test_create_project(client):
    response = client.post("/projects", json={"name": "Test Project: Create project"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project: Create project"
    assert "id" in data


def test_create_project_name_at_max_length(client):
    max_title = "a" * 255
    response = client.post("/projects", json={"name": max_title})
    assert response.status_code == 201


def test_create_project_missing_name_rejected(client):
    response = client.post("/projects", json={})
    assert response.status_code == 422


def test_create_project_name_too_long(client):
    long_title = "a" * 256
    response = client.post("/projects", json={"name": long_title})
    assert response.status_code == 422


def test_create_project_name_whitespace_only_rejected(client):
    response = client.post("/projects", json={"name": "         "})
    assert response.status_code == 422


def test_create_project_with_duplicate_name(client, project):
    response = client.post("/projects", json={"name": "Test Project"})
    assert response.status_code == 409


def test_create_project_with_duplicate_name_case_diff(client, project):
    response = client.post("/projects", json={"name": "TeSt PrOjEcT"})
    assert response.status_code == 409


def test_create_project_with_duplicate_name_whitespace_padded(client, project):
    response = client.post("/projects", json={"name": "Test Project         "})
    assert response.status_code == 409


def test_get_project(client, project):
    response = client.get(f"/projects/{project.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["id"] == project.id


def test_list_projects(client):
    response = client.get("/projects")
    assert response.status_code == 200


def test_list_projects_with_limit(client, project):
    client.post("/projects", json={"name": "Test Project 2"})
    client.post("/projects", json={"name": "Test Project 3"})
    response = client.get("/projects?limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_nonexistent_project(client):
    response = client.get("/projects/9999")
    assert response.status_code == 404


def test_list_projects_invalid_limit_rejected(client):
    response = client.get("/projects?limit=0")
    assert response.status_code == 400
    response = client.get("/projects?limit=-1")
    assert response.status_code == 400


def test_list_projects_scoped_to_owner(client, as_user, other_user, project):
    response = client.get("/projects")
    own_ids = [p["id"] for p in response.json()]
    assert project.id in own_ids
    with as_user(other_user):
        other_user_projects = client.get("/projects").json()
        other_user_ids = [p["id"] for p in other_user_projects]
    assert project.id not in other_user_ids


def test_get_project_ownership_enforcement(client, as_user, other_user, project):
    with as_user(other_user):
        response = client.get(f"/projects/{project.id}")
    assert response.status_code == 404


def test_list_projects_unauthenticated(anon_client):
    response = anon_client.get("/projects")
    assert response.status_code == 401


def test_update_project(client, project):
    response = client.put(f"/projects/{project.id}", json={"name": "Updated Project"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Project"
    assert data["id"] == project.id


def test_update_project_name_at_max_length(client, project):
    max_title = "b" * 255
    response = client.put(f"/projects/{project.id}", json={"name": max_title})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == max_title
    assert data["id"] == project.id


def test_rename_project_to_its_own_name(client, project):
    response = client.put(f"/projects/{project.id}", json={"name": "Test Project"})
    assert response.status_code == 200


def test_rename_project_to_its_own_name_case_only(client, project):
    response = client.put(f"/projects/{project.id}", json={"name": "test project"})
    assert response.status_code == 200


def test_update_project_name_too_long(client, project):
    long_title = "a" * 256
    response = client.put(f"/projects/{project.id}", json={"name": long_title})
    assert response.status_code == 422


def test_update_project_name_whitespace_only_rejected(client, project):
    response = client.put(f"/projects/{project.id}", json={"name": "         "})
    assert response.status_code == 422


def test_update_project_with_duplicate_name(client, project):
    response = client.post("/projects", json={"name": "Test Project: Update project with duplicate name"})
    project_id = response.json()['id']

    response = client.put(f"/projects/{project_id}", json={"name": "Test Project"})
    assert response.status_code == 409


def test_update_project_with_duplicate_name_case_diff(client, project):
    response = client.post("/projects",
                           json={"name": "Test Project: Update project with duplicate name case-different"})
    project_id = response.json()['id']

    response = client.put(f"/projects/{project_id}", json={"name": "TeSt PrOjEcT"})
    assert response.status_code == 409


def test_update_project_with_duplicate_name_whitespace_padded(client, project):
    response = client.post("/projects",
                           json={"name": "Test Project: Update project with duplicate name whitespace-padded"})
    project_id = response.json()['id']

    response = client.put(f"/projects/{project_id}", json={"name": "Test Project         "})
    assert response.status_code == 409


def test_update_nonexistent_project_returns_404(client, project):
    response = client.put("/projects/9999", json={"name": "Test Project"})
    assert response.status_code == 404


def test_update_project_ownership_enforcement(client, as_user, other_user, project):
    with as_user(other_user):
        response = client.put(f"/projects/{project.id}", json={"name": "Updated Project"})
    assert response.status_code == 404


def test_delete_project(client, project):
    response = client.delete(f"/projects/{project.id}")
    assert response.status_code == 204


def test_delete_nonexistent_project(client):
    response = client.delete("/projects/9999")
    assert response.status_code == 404


def test_delete_project_ownership_enforcement(client, as_user, other_user, project):
    with as_user(other_user):
        response = client.delete(f"/projects/{project.id}")
    assert response.status_code == 404
