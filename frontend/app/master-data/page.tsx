"use client";
import { useEffect, useState } from "react";
import { Shell } from "../_components";
import { Crud } from "../_crud";
import { api } from "../../lib/api";
import { usePermission, useSession } from "../../lib/rbac";
const roles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "PROCUREMENT_OFFICER",
  "STORE_MANAGER",
  "DEPARTMENT_HEAD",
  "ASSET_MANAGER",
  "MAINTENANCE",
  "FINANCE",
  "AUDITOR",
  "EMPLOYEE",
].map((x) => ({ value: x, label: x.replaceAll("_", " ") }));
export default function MasterData() {
  const mayManageUsers = usePermission("users.manage");
  const currentUser = useSession();
  const [categories, setCategories] = useState<any[]>([]),
    [departments, setDepartments] = useState<any[]>([]);
  async function choices() {
    const [c, d] = await Promise.all([
      api("/masters/categories"),
      api("/masters/departments"),
    ]);
    setCategories(c);
    setDepartments(d);
  }
  useEffect(() => {
    choices();
  }, []);
  return (
    <Shell title="Master Data">
      <p className="muted">
        Manage the records used throughout assets, procurement, and reporting.
      </p>
      <Crud
        title="Departments"
        endpoint="/masters/departments"
        onChanged={choices}
        fields={[
          { name: "name", label: "Department name", required: true },
          { name: "code", label: "Code", required: true },
        ]}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Department" },
        ]}
      />
      <Crud
        title="Asset Categories"
        endpoint="/masters/categories"
        onChanged={choices}
        fields={[
          { name: "name", label: "Category name", required: true },
          { name: "code", label: "Code", required: true },
          {
            name: "depreciationRate",
            label: "Depreciation %",
            type: "number",
            required: true,
          },
        ]}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Category" },
          { key: "depreciationRate", label: "Depreciation %" },
        ]}
      />
      <Crud
        title="Products"
        endpoint="/masters/products"
        fields={[
          { name: "name", label: "Product name", required: true },
          { name: "sku", label: "SKU", required: true },
          { name: "manufacturer", label: "Manufacturer" },
          { name: "description", label: "Description" },
          {
            name: "categoryId",
            label: "Category",
            type: "select",
            required: true,
            options: categories.map((x) => ({ value: x.id, label: x.name })),
          },
        ]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product" },
          { key: "manufacturer", label: "Manufacturer" },
          {
            key: "category",
            label: "Category",
            render: (r) => r.category?.name,
          },
        ]}
      />
      {mayManageUsers && (
        <Crud
          title="Users & Roles"
          endpoint="/masters/users"
          managePermission="users.manage"
          fields={[
            { name: "name", label: "Full name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            {
              name: "password",
              label: "Password (required for new users)",
              type: "password",
            },
            {
              name: "role",
              label: "Role",
              type: "select",
              required: true,
              options: roles.filter(
                (role) =>
                  currentUser?.role === "SUPER_ADMIN" ||
                  role.value !== "SUPER_ADMIN",
              ),
            },
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              options: departments.map((x) => ({ value: x.id, label: x.name })),
            },
          ]}
          columns={[
            { key: "name", label: "User" },
            { key: "email", label: "Email" },
            {
              key: "role",
              label: "Role",
              render: (r) => r.role.replaceAll("_", " "),
            },
            {
              key: "department",
              label: "Department",
              render: (r) => r.department?.name || "—",
            },
          ]}
        />
      )}
    </Shell>
  );
}
