import sqlalchemy as sa
from decimal import Decimal

from app.models.item import Item
from app.models.user import User


def test_foreign_keys_pragma_is_active(db, sqlite_only):
    result = db.execute(sa.text("PRAGMA foreign_keys")).scalar()
    assert result == 1


def test_read_main(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Server is running"}


def test_create_item(client):
    response = client.post("/items", json={"title": "Test Item"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["is_done"] == False
    assert "id" in data


def test_create_item_with_project(client):
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()["id"]

    response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["is_done"] == False
    assert data["project_id"] == project_id
    assert "id" in data


def test_create_child_item(client, item):
    parent_id = item.id

    child_response = client.post("/items", json={"title": "Child Task", "parent_id": parent_id})
    assert child_response.status_code == 201
    assert child_response.json()["parent_id"] == parent_id


def test_create_item_title_too_long(client):
    long_title = "a" * 256
    response = client.post("/items", json={"title": long_title})
    assert response.status_code == 422


def test_create_item_title_at_max_length(client):
    max_title = "a" * 255
    response = client.post("/items", json={"title": max_title})
    assert response.status_code == 201


def test_create_item_without_project_returns_null(client):
    response = client.post("/items", json={"title": "Test Item"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["is_done"] == False
    assert data["project_id"] is None
    assert "id" in data


def test_create_item_title_null_rejected(client):
    response = client.post("/items", json={"title": None})
    assert response.status_code == 422


def test_create_item_title_whitespace_only_rejected(client):
    response = client.post("/items", json={"title": "      "})
    assert response.status_code == 422


def test_create_item_with_nonexistent_project(client):
    response = client.post("/items", json={"title": "Test Item", "project_id": 9999})
    assert response.status_code == 400


def test_create_item_with_another_users_project(client, as_user, other_user):
    response = client.post("/projects", json={"name": "Test Project: Create item with another users project"})
    project_id = response.json()["id"]

    with as_user(other_user):
        response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
    assert response.status_code == 400


def test_create_item_with_nonexistent_parent(client):
    response = client.post("/items", json={"title": "Orphan", "parent_id": 999999})
    assert response.status_code == 400


def test_create_item_with_another_users_parent(client, as_user, other_user, item):
    with as_user(other_user):
        response = client.post("/items", json={"title": "Malicious child", "parent_id": item.id})
    assert response.status_code == 400


def test_create_item_exceeds_max_depth_rejected(client, item):
    child_id = \
        client.post("/items", json={"title": "Child Create Max Depth Rejected", "parent_id": item.id}).json()[
            "id"]
    grandchild_id = \
        client.post("/items", json={"title": "Grandchild Create Max Depth Rejected", "parent_id": child_id}).json()[
            "id"]
    response = client.post("/items",
                           json={"title": "Grand-Grandchild Create Max Depth Rejected",
                                 "parent_id": grandchild_id})
    assert response.status_code == 400


def test_get_item(client, item):
    response = client.get(f"/items/{item.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == item.id
    assert data["title"] == "Test Item"
    assert data["description"] == "Test Description"
    assert data["is_done"] == False


def test_get_nonexistent_item(client):
    response = client.get("/items/9999")
    assert response.status_code == 404


def test_get_item_ownership_enforcement(client, as_user, other_user, item):
    with as_user(other_user):
        response = client.get(f"/items/{item.id}")
    assert response.status_code == 404


def test_update_item(client):
    response = client.post("/items", json={"title": "Test Item", "description": "Test Description"})
    item_id = response.json()["id"]

    response = client.put(f"/items/{item_id}", json={"is_done": True})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["description"] == "Test Description"
    assert data["is_done"] == True
    assert data["id"] == item_id


def test_update_item_title_null_rejected(client, item):
    response = client.put(f"/items/{item.id}", json={"title": None})
    assert response.status_code == 422


def test_update_item_assign_project(client, project, item):
    response = client.put(f"/items/{item.id}", json={"project_id": project.id})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["id"] == item.id
    assert data["project_id"] == project.id


def test_update_item_reassign_project(client, project):
    response = client.post("/items", json={"title": "Test Item", "project_id": project.id})
    item_id = response.json()["id"]

    response = client.post("/projects", json={"name": "New Project"})
    new_project_id = response.json()["id"]

    response = client.put(f"/items/{item_id}", json={"project_id": new_project_id})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == item_id
    assert data["project_id"] == new_project_id


def test_update_item_unassign_project(client, project, item):
    response = client.put(f"/items/{item.id}", json={"project_id": project.id})
    assert response.status_code == 200

    response = client.put(f"/items/{item.id}", json={"project_id": None})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == item.id
    assert data["project_id"] is None


def test_update_item_with_nonexistent_project(client, item):
    response = client.put(f"/items/{item.id}", json={"project_id": 9999})
    assert response.status_code == 400


def test_update_item_with_another_users_project(client, as_user, other_user, project):
    with as_user(other_user):
        response = client.post("/items", json={"title": "Test Item"})
        item_id = response.json()["id"]

        response = client.put(f"/items/{item_id}", json={"project_id": project.id})
    assert response.status_code == 400


def test_update_item_creates_cycle(client, item):
    child_response = client.post("/items", json={"title": "Cycle Child", "parent_id": item.id})
    child_id = child_response.json()["id"]

    response = client.put(f"/items/{item.id}", json={"parent_id": child_id})
    assert response.status_code == 400


def test_update_item_ownership_enforcement(client, as_user, other_user, item):
    with as_user(other_user):
        response = client.put(f"/items/{item.id}", json={"is_done": True})
    assert response.status_code == 404


def test_update_item_parent_exceeds_max_depth_rejected(client, item):
    child_id = \
        client.post("/items", json={"title": "Child Create Max Depth Rejected", "parent_id": item.id}).json()[
            "id"]
    grandchild_id = \
        client.post("/items", json={"title": "Grandchild Create Max Depth Rejected", "parent_id": child_id}).json()[
            "id"]

    task_to_update_id = client.post("/items", json={"title": "Grand-Grandchild Create Max Depth Rejected"}).json()["id"]
    response = client.put(f"/items/{task_to_update_id}", json={"parent_id": grandchild_id})
    assert response.status_code == 400


def test_delete_item(client, item):
    response = client.delete(f"/items/{item.id}")
    assert response.status_code == 204


def test_delete_nonexistent_item(client):
    response = client.delete("/items/9999")
    assert response.status_code == 404


def test_delete_item_permanently(client, item):
    response = client.delete(f"/items/{item.id}/permanent")
    assert response.status_code == 204

    response = client.get(f"/items/{item.id}")
    assert response.status_code == 404


def test_delete_item_already_deleted_returns_404(client, item):
    client.delete(f"/items/{item.id}")
    deleted_at = client.get(f"/items/{item.id}").json()["deleted_at"]
    response = client.delete(f"/items/{item.id}")
    assert response.status_code == 404
    assert client.get(f"/items/{item.id}").json()["deleted_at"] == deleted_at


def test_delete_cascades_to_children(client, item):
    child_response = client.post("/items", json={"title": "Child To Delete", "parent_id": item.id})
    child_id = child_response.json()["id"]

    response = client.delete(f"/items/{item.id}")
    assert response.status_code == 204

    response = client.get(f"/items/{child_id}")
    assert response.status_code == 200
    assert response.json()["is_deleted"] is True


def test_permanent_delete_cascades_to_children(db, client, item):
    child_response = client.post("/items", json={"title": "Child To Delete", "parent_id": item.id})
    child_id = child_response.json()["id"]

    response = client.delete(f"/items/{item.id}/permanent")
    assert response.status_code == 204

    child_in_db = db.query(Item).filter(Item.id == child_id).first()

    assert child_in_db is None


def test_delete_project_sets_item_project_id_null(client, project, item):
    client.put(f"/items/{item.id}", json={"project_id": project.id})

    response = client.delete(f"/projects/{project.id}")
    assert response.status_code == 204

    response = client.get(f"/items/{item.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == item.id
    assert data["project_id"] is None


def test_delete_user_cascades_to_items(db, client, item):
    response = client.delete("/users/me")
    assert response.status_code == 204

    item_in_db = db.query(Item).filter(Item.id == item.id).first()

    assert item_in_db is None


def test_delete_item_ownership_enforcement(client, as_user, other_user, item):
    with as_user(other_user):
        response = client.delete(f"/items/{item.id}")
    assert response.status_code == 404


def test_restore_cascades_to_children(client, item):
    child_id = client.post("/items", json={"title": "Child To Restore", "parent_id": item.id}).json()["id"]

    client.delete(f"/items/{item.id}")

    response = client.post(f"/items/{item.id}/restore")
    assert response.status_code == 200

    response = client.get(f"/items/{child_id}")
    assert response.status_code == 200


def test_restore_parent_does_not_restore_separately_deleted_child(client, item):
    response = client.post("/items", json={"title": "Child To Remain Soft-Deleted Restore", "parent_id": item.id})
    child_id = response.json()["id"]

    client.delete(f"/items/{child_id}")
    child_deleted_at = client.get(f"/items/{child_id}").json()["deleted_at"]

    client.delete(f"/items/{item.id}")
    assert child_deleted_at != client.get(f"/items/{item.id}").json()["deleted_at"]

    client.post(f"/items/{item.id}/restore")
    assert client.get(f"/items/{child_id}").json()["is_deleted"] == True
    assert client.get(f"/items/{child_id}").json()["deleted_at"] == child_deleted_at


def test_reorder_places_item_between_two_siblings(client, item):
    child_a = client.post("/items", json={"title": "Child A", "parent_id": item.id}).json()
    child_b = client.post("/items", json={"title": "Child B", "parent_id": item.id}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": item.id}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={
        "parent_id": item.id,
        "before_id": child_a["id"],
        "after_id": child_b["id"]
    })

    assert response.status_code == 200
    data = response.json()
    assert Decimal(child_a["position"]) < Decimal(data["position"]) < Decimal(child_b["position"])
    assert data["parent_id"] == item.id


def test_reorder_to_top_of_list(client, item):
    child_a = client.post("/items", json={"title": "Child A", "parent_id": item.id}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": item.id}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={
        "parent_id": item.id,
        "after_id": child_a["id"],
    })

    assert response.status_code == 200
    assert Decimal(response.json()["position"]) < Decimal(child_a["position"])


def test_reorder_to_bottom_of_list(client, item):
    child_a = client.post("/items", json={"title": "Child A", "parent_id": item.id}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": item.id}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={
        "parent_id": item.id,
        "before_id": child_a["id"],
    })

    assert response.status_code == 200
    assert Decimal(response.json()["position"]) > Decimal(child_a["position"])


def test_reorder_into_empty_group_gets_first_position(client, item):
    mover = client.post("/items", json={"title": "Mover"}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={"parent_id": item.id})
    assert response.status_code == 200
    data = response.json()
    assert data["parent_id"] == item.id
    assert Decimal(data["position"]) == Decimal(100)


def test_reorder_makes_top_level_task_a_subtask(client, item):
    mover = client.post("/items", json={"title": "Was Top Level"}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={"parent_id": item.id})
    assert response.status_code == 200
    assert response.json()["parent_id"] == item.id


def test_reorder_makes_subtask_a_top_level_task(client, item):
    child = client.post("/items", json={"title": "Child To Promote", "parent_id": item.id}).json()

    response = client.patch(f"/items/{child["id"]}/reorder", json={"parent_id": None})
    assert response.status_code == 200
    assert response.json()["parent_id"] is None


def test_reorder_triggers_rebalance_when_precision_exhausted(postgres_only, db, client, item):
    child_a = client.post("/items", json={"title": "Child A", "parent_id": item.id}).json()
    child_b = client.post("/items", json={"title": "Child B", "parent_id": item.id}).json()

    db_a = db.query(Item).filter(Item.id == child_a["id"]).first()
    db_a.position = Decimal("100")
    db_b = db.query(Item).filter(Item.id == child_b["id"]).first()
    db_b.position = Decimal("100." + "1" * 21)
    db.commit()

    mover = client.post("/items", json={"title": "Mover", "parent_id": item.id}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={
        "parent_id": item.id,
        "before_id": child_a["id"],
        "after_id": child_b["id"],
    })
    assert response.status_code == 200

    siblings = (
        db.query(Item)
        .filter(Item.parent_id == item.id)
        .order_by(Item.position)
        .all()
    )

    for sibling in siblings:
        assert sibling.position.as_tuple().exponent >= -20


def test_reorder_creates_cycle_rejected(client, item):
    child = client.post("/items", json={"title": "Reorder Cycle Child", "parent_id": item.id}).json()

    response = client.patch(f"/items/{item.id}/reorder", json={"parent_id": child["id"]})
    assert response.status_code == 400


def test_reorder_with_nonexistent_parent(client, item):
    response = client.patch(f"/items/{item.id}/reorder", json={"parent_id": 9999})
    assert response.status_code == 400


def test_reorder_self_as_neighbor_rejected(client, item):
    response = client.patch(f"/items/{item.id}/reorder", json={"before_id": item.id})
    assert response.status_code == 400


def test_reorder_nonexistent_neighbor_rejected(client, item):
    response = client.patch(f"/items/{item.id}/reorder", json={"before_id": 9999})
    assert response.status_code == 400


def test_reorder_neighbor_from_different_parent_rejected(client):
    parent_one = client.post("/items", json={"title": "Parent One"}).json()
    parent_two = client.post("/items", json={"title": "Parent Two"}).json()

    child_of_one = client.post("/items", json={"title": "Child of One", "parent_id": parent_one["id"]}).json()
    child_of_two = client.post("/items", json={"title": "Child of Two", "parent_id": parent_two["id"]}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": parent_one["id"]}).json()

    response = client.patch(f"/items/{mover["id"]}/reorder", json={
        "parent_id": parent_one["id"],
        "before_id": child_of_one["id"],
        "after_id": child_of_two["id"]
    })
    assert response.status_code == 400


def test_reorder_nonexistent_item(client):
    response = client.patch("/items/9999/reorder", json={"parent_id": None})
    assert response.status_code == 404


def test_reorder_deleted_item_returns_404(client, item):
    client.delete(f"/items/{item.id}")

    response = client.patch(f"/items/{item.id}/reorder", json={"parent_id": None})
    assert response.status_code == 404


def test_reorder_archived_item_returns_404(client, item):
    client.put(f"/items/{item.id}", json={"is_archived": True})

    response = client.patch(f"/items/{item.id}/reorder", json={"parent_id": None})
    assert response.status_code == 404


def test_reorder_item_ignores_hidden_siblings_for_adjacency(client, item):
    child_a = client.post("/items", json={"title": "Ignore Hidden Siblings, Child A", "parent_id": item.id}).json()
    child_b = client.post("/items", json={"title": "Ignore Hidden Siblings, Child B", "parent_id": item.id}).json()
    child_c = client.post("/items", json={"title": "Ignore Hidden Siblings, Child C", "parent_id": item.id}).json()
    mover = client.post("/items", json={"title": "Ignore Hidden Siblings, Mover", "parent_id": item.id}).json()

    client.put(f"/items/{child_b["id"]}", json={"is_done": True})

    response = client.patch(f"/items/{mover["id"]}/reorder",
                            json={"parent_id": item.id, "before_id": child_a["id"], "after_id": child_c["id"]})
    assert response.status_code == 200


def test_reorder_with_another_users_parent_rejected(client, as_user, other_user, item):
    with as_user(other_user):
        other_parent = client.post("/items", json={"title": "Other User's Parent"}).json()
    response = client.patch(f"/items/{item.id}/reorder", json={"parent_id": other_parent["id"]})
    assert response.status_code == 400


def test_reorder_neighbor_owned_by_another_user_rejected(client, as_user, other_user, item):
    with as_user(other_user):
        other_item = client.post("/items", json={"title": "Other User Item"}).json()
    response = client.patch(f"/items/{item.id}/reorder", json={"before_id": other_item["id"]})
    assert response.status_code == 400


def test_reorder_item_ownership_enforcement(client, as_user, other_user, item):
    with as_user(other_user):
        response = client.patch(f"/items/{item.id}/reorder", json={"parent_id": None})
        assert response.status_code == 404


def test_reorder_item_exceeds_max_depth_rejected(client, item):
    child_id = \
        client.post("/items", json={"title": "Child Create Max Depth Rejected", "parent_id": item.id}).json()[
            "id"]
    grandchild_id = \
        client.post("/items", json={"title": "Grandchild Create Max Depth Rejected", "parent_id": child_id}).json()[
            "id"]
    task_to_update_id = client.post("/items", json={"title": "Grand-Grandchild Create Max Depth Rejected"}).json()[
        "id"]
    response = client.patch(f"/items/{task_to_update_id}/reorder", json={"parent_id": grandchild_id})
    assert response.status_code == 400
