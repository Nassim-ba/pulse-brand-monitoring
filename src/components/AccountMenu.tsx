"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Logout from "@mui/icons-material/Logout";
import { useData } from "./DataProvider";

/** Avatar with the signed-in user's name, e-mail and sign-out. */
export function AccountMenu() {
  const { meta } = useData();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const user = meta?.user;
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // A full page load clears all client state of the previous user.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload
    window.location.assign("/login");
  };

  return (
    <>
      <Tooltip title={user.name}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Konto" sx={{ p: 0.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: "var(--md-tertiary-container)",
              color: "var(--md-on-tertiary-container)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {initials}
          </Box>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: "var(--md-surface-container)", minWidth: 240 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2">{user.name}</Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
            {user.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={logout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Abmelden
        </MenuItem>
      </Menu>
    </>
  );
}
