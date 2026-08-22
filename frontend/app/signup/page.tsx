"use client";
import { useState } from "react";
import Link from "next/link";
import { API } from "../../lib/api";
export default function Signup() {
  const [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      organizationName: "",
      organizationCode: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(API + "/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      localStorage.setItem("token", body.token);
      localStorage.setItem("user", JSON.stringify(body.user));
      location.href = "/dashboard";
    } catch (error: any) {
      setError(error.message || "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }
  function field(name: keyof typeof form, value: string) {
    setForm({ ...form, [name]: value });
  }
  return (
    <div className="loginwrap">
      <form className="login wide" onSubmit={submit}>
        <Link href="/" className="back">
          ← AssetFlow
        </Link>
        <h1>Create your workspace</h1>
        <p className="muted">Set up your organization administrator account.</p>
        <div className="formGrid">
          <label>
            Your name
            <input
              required
              minLength={2}
              className="input"
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label>
            Work email
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => field("email", e.target.value)}
            />
          </label>
          <label>
            Organization name
            <input
              required
              minLength={2}
              className="input"
              value={form.organizationName}
              onChange={(e) => field("organizationName", e.target.value)}
            />
          </label>
          <label>
            Organization code
            <input
              required
              minLength={2}
              pattern="[A-Za-z0-9-]+"
              className="input"
              placeholder="Example: OMC"
              value={form.organizationCode}
              onChange={(e) => field("organizationCode", e.target.value)}
            />
          </label>
          <label className="span2">
            Password
            <input
              required
              minLength={8}
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => field("password", e.target.value)}
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button disabled={busy} className="btn full">
          {busy ? "Creating…" : "Create workspace"}
        </button>
        <p className="muted center">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
