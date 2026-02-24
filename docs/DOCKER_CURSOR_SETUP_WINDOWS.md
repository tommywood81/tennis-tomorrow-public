# Docker + Cursor Setup on Windows

Fix "Access is denied" on `dockerDesktopLinuxEngine` or `buildx` so Docker works from Cursor's terminal.

---

## 1. Add your user to `docker-users`

Docker Desktop’s named pipes are only accessible to:

- The user who **launched** Docker Desktop  
- Members of **Administrators**  
- Members of **docker-users**

**Steps:**

1. Press `Win + X` → **Computer Management** (or right‑click **This PC** → **Manage**).
2. Go to **Local Users and Groups** → **Groups**.
3. Double‑click **docker-users**.
4. Click **Add** → enter your Windows username → **Check Names** → **OK** → **OK**.
5. **Log out and log back in** (or restart). Group changes only apply after a new login.

---

## 2. Start Docker Desktop first

1. Start **Docker Desktop** from the Start menu.
2. Wait until the whale icon is steady and it says **Docker Desktop is running**.
3. In a **normal** PowerShell or CMD (not Cursor), run:

   ```powershell
   docker ps
   ```

   If that works, Docker is fine. The remaining issue is Cursor’s environment.

---

## 3. Start Cursor as the same user

- Use the **same Windows user** that launched Docker Desktop.
- Start Cursor **after** Docker Desktop is running.

---

## 4. Use Cursor’s integrated terminal for Docker

- In Cursor: **Terminal** → **New Terminal** (or `` Ctrl+` ``).
- `cd` to your project and run:

  ```powershell
  cd d:\projects\xgb-opponent-aware
  docker ps
  docker compose -f deploy_local.yml up -d
  ```

- Use **only** `docker compose up` or `docker compose exec`—**never** `--build`. Dependencies are installed only in the Dockerfile or requirements.txt, not at runtime.
- The **integrated terminal** runs as your user.  
- **“Run terminal command”** / AI‑driven runs may use a sandbox that can’t access Docker’s pipe; if you see “Access is denied” only there, use the integrated terminal for Docker.

---

## 5. (Optional) Run Cursor as Administrator

If you’re in **docker-users** and it still fails:

1. Close Cursor.
2. Right‑click **Cursor** → **Run as administrator**.
3. Open your project, open the integrated terminal, and run `docker ps` and `docker compose -f deploy_local.yml up -d` again.

If it works only when “Run as administrator”, your user still doesn’t have the right pipe access; recheck **docker-users** and **log out / log in** again.

---

## 6. Antivirus / security software

- Some tools block access to Docker’s named pipes.
- Temporarily disable or add an exception for Docker Desktop, then retry `docker ps` from Cursor’s terminal.

---

## 7. Restart order (recommended)

1. **Restart** the PC (especially after adding **docker-users**).
2. **Log in**.
3. Start **Docker Desktop** and wait until it’s running.
4. Start **Cursor** and open your project.
5. Use the **integrated terminal** for all `docker` and `docker compose` commands.

---

## Quick checklist

- [ ] User added to **docker-users**
- [ ] **Logged out and back in** (or restarted) after adding to **docker-users**
- [ ] **Docker Desktop** running before Cursor
- [ ] **Cursor** started as the same user
- [ ] Using **Cursor’s integrated terminal** for Docker (not “Run terminal command”)
- [ ] `docker ps` works in **external** PowerShell/CMD
- [ ] Antivirus not blocking Docker

---

## Verify

In Cursor’s integrated terminal:

```powershell
cd d:\projects\xgb-opponent-aware
docker ps
docker compose -f deploy_local.yml up -d
docker compose -f deploy_local.yml ps
```

- Backend: http://localhost:8000/api  
- Frontend: http://localhost:3000  
