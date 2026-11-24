"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ALLERGENS,
  profileFor,
  saveProfile,
  type StaffProfile,
} from "@/lib/profiles";
import { type Employee, type Store } from "@/lib/store";
import { AllergyAlert } from "./allergy-alert";
export function StaffProfileEditor({
  store,
  user,
  commit,
}: {
  store: Store;
  user: Employee;
  commit: (s: Store) => void;
}) {
  const current = profileFor(store, user.id);
  const [declaration, setDeclaration] = useState<StaffProfile["declaration"]>(
    current.declaration,
  );
  const [allergens, setAllergens] = useState(current.allergens);
  const [notes, setNotes] = useState(current.notes);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <Card className="profile-editor">
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR PREFERENCES, CLEARLY COMMUNICATED</div>
          <h2>My profile & allergy notes</h2>
          <p>
            {user.name} · {user.id} · {user.department}
          </p>
        </div>
      </div>
      <div className="alert warning">
        Use fictional information only in this demo. Real allergy information is
        sensitive health data and must not be stored in this public,
        browser-local prototype.
      </div>
      <AllergyAlert note={current} label="Currently saved declaration" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          try {
            commit(
              saveProfile(
                store,
                user.id,
                { declaration, allergens, notes },
                Date.now(),
              ),
            );
            setMessage(
              "Profile saved. New orders include this note; active orders show the update and require a fresh operator review.",
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed.");
          }
        }}
      >
        <label className="field">
          <span>Allergy declaration</span>
          <select
            value={declaration}
            onChange={(e) => {
              const value = e.target.value as StaffProfile["declaration"];
              setDeclaration(value);
              if (value !== "Allergies declared") {
                setAllergens([]);
                setNotes("");
              }
            }}
          >
            {["Not provided", "No known allergies", "Allergies declared"].map(
              (d) => (
                <option key={d}>{d}</option>
              ),
            )}
          </select>
        </label>
        {declaration === "Allergies declared" && (
          <>
            <fieldset className="allergen-options">
              <legend>Select allergens (example data only)</legend>
              {ALLERGENS.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={allergens.includes(a)}
                    onChange={(e) =>
                      setAllergens(
                        e.target.checked
                          ? [...allergens, a]
                          : allergens.filter((v) => v !== a),
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>Other allergies or preparation notes</span>
              <textarea
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example only: avoid peanut oil; discuss cross-contact precautions."
                rows={4}
              />
              <small>{notes.length}/500 characters</small>
            </label>
          </>
        )}
        {error && (
          <div className="alert danger" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="alert success" role="status">
            {message}
          </div>
        )}
        <Button className="primary" type="submit">
          Save profile & alert active orders
        </Button>
      </form>
      <p className="muted">
        These are staff-reported notes, not verified ingredient matching or a
        guarantee that a meal is safe. Contact the café directly for urgent
        changes; do not rely on this demo for allergy safety.
      </p>
    </Card>
  );
}
