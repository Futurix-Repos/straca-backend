/* global use */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use("straca");

db.orders.find({}, { reference: 1, status: 1 }).limit(10);
