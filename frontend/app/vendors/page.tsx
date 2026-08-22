"use client";
import { Shell } from "../_components";
import { Crud } from "../_crud";
export default function Vendors() {
  return (
    <Shell title="Vendor Management">
      <Crud
        title="Vendors"
        endpoint="/vendors"
        managePermission="vendors.manage"
        fields={[
          { name: "name", label: "Vendor name", required: true },
          { name: "code", label: "Code", required: true },
          { name: "gstin", label: "GSTIN" },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone" },
          { name: "address", label: "Address" },
          { name: "rating", label: "Rating (0–5)", type: "number" },
        ]}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Vendor" },
          { key: "gstin", label: "GSTIN" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "rating", label: "Rating" },
        ]}
      />
    </Shell>
  );
}
