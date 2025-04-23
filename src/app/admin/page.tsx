"use client";

import React, { useState } from "react";
import { H2, H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Trash2, UserCog } from "lucide-react";
import type { User, Exercise } from "@prisma/client"; // Import generated types
import { api } from "@/trpc/react";

// --- Exercise Management --- //

function ExerciseManager() {
  const utils = api.useUtils(); // For invalidating cache
  const [newExerciseName, setNewExerciseName] = useState("");
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(
    null,
  );

  const exercisesQuery = api.exercise.list.useQuery();

  const addExerciseMutation = api.exercise.add.useMutation({
    onSuccess: async () => {
      toast.success("Exercise added successfully!");
      await utils.exercise.list.invalidate(); // Refetch list after adding
      setNewExerciseName(""); // Clear input field
    },
    onError: (error) => {
      toast.error(`Error adding exercise: ${error.message}`);
    },
  });

  const deleteExerciseMutation = api.exercise.delete.useMutation({
    onSuccess: async () => {
      toast.success("Exercise deleted successfully!");
      await utils.exercise.list.invalidate(); // Refetch list after deleting
      setExerciseToDelete(null); // Close dialog implicitly via state change
    },
    onError: (error) => {
      toast.error(`Error deleting exercise: ${error.message}`);
    },
    onSettled: () => {
      // Ensure dialog state is reset even if deletion fails but mutation settles
      // This might be redundant if onSuccess/onError handle it, but safe to include
      // setExerciseToDelete(null);
    },
  });

  const handleAddExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (newExerciseName.trim()) {
      addExerciseMutation.mutate({ name: newExerciseName.trim() });
    }
  };

  const handleDeleteExercise = () => {
    if (exerciseToDelete) {
      deleteExerciseMutation.mutate({ id: exerciseToDelete.id });
    }
  };

  return (
    <section className="mb-12">
      <H3 className="mb-4 border-b pb-2">Manage Exercises</H3>
      <form onSubmit={handleAddExercise} className="mb-4 flex gap-2">
        <Input
          type="text"
          placeholder="New exercise name..."
          value={newExerciseName}
          onChange={(e) => setNewExerciseName(e.target.value)}
          disabled={addExerciseMutation.isPending}
        />
        <Button
          type="submit"
          disabled={addExerciseMutation.isPending || !newExerciseName.trim()}
        >
          {addExerciseMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Add Exercise
        </Button>
      </form>

      {exercisesQuery.isLoading ? (
        <P>Loading exercises...</P>
      ) : exercisesQuery.isError ? (
        <P className="text-destructive">
          Error loading exercises: {exercisesQuery.error.message}
        </P>
      ) : exercisesQuery.data && exercisesQuery.data.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercisesQuery.data.map((exercise) => (
                <TableRow key={exercise.id}>
                  <TableCell className="font-medium">{exercise.name}</TableCell>
                  <TableCell>{exercise.id}</TableCell>
                  <TableCell className="text-right">
                    <Dialog
                      open={exerciseToDelete?.id === exercise.id}
                      onOpenChange={(open) =>
                        !open && setExerciseToDelete(null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setExerciseToDelete(exercise)}
                          disabled={
                            deleteExerciseMutation.isPending &&
                            exerciseToDelete?.id === exercise.id
                          }
                        >
                          {deleteExerciseMutation.isPending &&
                          exerciseToDelete?.id === exercise.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Exercise?</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete the exercise &quot;
                            <strong>{exerciseToDelete?.name}</strong>&quot;?
                            This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button
                              variant="outline"
                              disabled={deleteExerciseMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteExercise}
                            disabled={deleteExerciseMutation.isPending}
                          >
                            {deleteExerciseMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete Exercise
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <P>No exercises found.</P>
      )}
    </section>
  );
}

// --- User Management --- //

function UserManager() {
  const utils = api.useUtils();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [newUserClerkId, setNewUserClerkId] = useState(""); // <-- State for new user ID input

  const usersQuery = api.user.list.useQuery();

  // Mutation for adding a user
  const addUserMutation = api.user.add.useMutation({
    onSuccess: async () => {
      toast.success("User added successfully!");
      await utils.user.list.invalidate(); // Refetch list
      setNewUserClerkId(""); // Clear input
    },
    onError: (error) => {
      toast.error(`Error adding user: ${error.message}`);
    },
  });

  const deleteUserMutation = api.user.delete.useMutation({
    onSuccess: async () => {
      toast.success("User deleted successfully!");
      await utils.user.list.invalidate();
      setUserToDelete(null);
    },
    onError: (error) => {
      toast.error(`Error deleting user: ${error.message}`);
    },
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserClerkId.trim()) {
      addUserMutation.mutate({ clerkUserId: newUserClerkId.trim() });
    }
  };

  const handleDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate({ id: userToDelete.id });
    }
  };

  return (
    <section>
      <H3 className="mb-4 border-b pb-2">Manage Users</H3>

      {/* Add User Form */}
      <form onSubmit={handleAddUser} className="mb-4 flex gap-2">
        <Input
          type="text"
          placeholder="New user Clerk ID (e.g., user_2abc...)"
          value={newUserClerkId}
          onChange={(e) => setNewUserClerkId(e.target.value)}
          disabled={addUserMutation.isPending}
          className="font-mono text-xs"
        />
        <Button
          type="submit"
          disabled={addUserMutation.isPending || !newUserClerkId.trim()}
        >
          {addUserMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Add User
        </Button>
      </form>

      {/* User List Table */}
      {usersQuery.isLoading ? (
        <P>Loading users...</P>
      ) : usersQuery.isError ? (
        <P className="text-destructive">
          Error loading users: {usersQuery.error.message}
        </P>
      ) : usersQuery.data && usersQuery.data.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clerk User ID</TableHead>
                <TableHead>DB ID</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs">
                    {user.clerkUserId}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {user.id} {/* Display DB ID as well */}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Delete User Dialog */}
                    <Dialog
                      open={userToDelete?.id === user.id}
                      onOpenChange={(open) => !open && setUserToDelete(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setUserToDelete(user)}
                          disabled={
                            deleteUserMutation.isPending &&
                            userToDelete?.id === user.id
                          }
                        >
                          {deleteUserMutation.isPending &&
                          userToDelete?.id === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete User?</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete the user with Clerk
                            ID &quot;
                            <strong>{userToDelete?.clerkUserId}</strong>&quot;?
                            This will also delete all their associated workout
                            data. This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button
                              variant="outline"
                              disabled={deleteUserMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteUser}
                            disabled={deleteUserMutation.isPending}
                          >
                            {deleteUserMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete User
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <P>No users found.</P>
      )}
    </section>
  );
}

// --- Admin Page --- //

export default function AdminPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8 flex items-center gap-3">
        <UserCog className="h-8 w-8" />
        <H2>Admin Management</H2>
      </div>

      <ExerciseManager />
      <UserManager />
    </div>
  );
}
