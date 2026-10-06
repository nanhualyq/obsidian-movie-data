## ADDED Requirements

### Requirement: Delete an entity from the edit form
The edit form for an existing movie or actor SHALL provide a Delete action, separate from Save and Cancel. The Delete action SHALL require an explicit confirmation step before anything is written; declining the confirmation SHALL leave the form open and write nothing. The Delete action SHALL NOT be offered for an entity that has not been saved yet (an add form in progress).

#### Scenario: Confirm deletion of a movie
- **WHEN** the user opens an existing movie's form, clicks Delete, and confirms
- THEN the movie is removed, the view returns to the list, and the list no longer shows the movie without a plugin reload

#### Scenario: Decline deletion
- **WHEN** the user clicks Delete and then declines the confirmation
- THEN nothing is written, the form stays open, and the entry remains in the list

#### Scenario: Add form has no delete
- **WHEN** the user opens the add form for a movie or actor that was never saved
- THEN no Delete action is offered

### Requirement: Deleting a referenced actor is blocked
When the user attempts to delete an actor that is referenced by at least one movie (i.e., any movie's `actorIds` contains the actor's id), the deletion SHALL be blocked: the view shows a warning stating how many movies reference the actor, and no data or files are written. Deleting an actor that no movie references SHALL proceed normally through the confirmation step.

#### Scenario: Actor referenced by movies
- **WHEN** the user clicks Delete on an actor that appears in the `actorIds` of one or more movies and confirms
- THEN the deletion is blocked, a warning naming the number of referencing movies is shown, and the actor and all movies are unchanged

#### Scenario: Unreferenced actor
- **WHEN** the user clicks Delete on an actor no movie references and confirms
- THEN the actor is removed and the view returns to the list, which no longer shows the actor
