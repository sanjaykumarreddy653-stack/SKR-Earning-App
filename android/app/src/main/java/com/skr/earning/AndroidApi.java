package com.skr.earning;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.security.MessageDigest;
import java.util.regex.Pattern;

public class AndroidApi extends SQLiteOpenHelper {

    private static final String DB_NAME = "skr_earning.db";
    private static final int DB_VERSION = 2;
    private static final double TYPING_REWARD = 2.0;
    private static final double DAILY_LIMIT = 50.0;

    private final Context context;

    public AndroidApi(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
        this.context = context;
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        createTables(db);
        addTasks(db);
    }

    private void createTables(SQLiteDatabase db) {

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS users (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "username TEXT UNIQUE NOT NULL," +
            "balance REAL NOT NULL DEFAULT 0," +
            "created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
        );

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS accounts (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "username TEXT UNIQUE NOT NULL," +
            "password_hash TEXT NOT NULL," +
            "created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
        );

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS typing_tasks (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "task_text TEXT NOT NULL," +
            "reward REAL NOT NULL DEFAULT 2," +
            "active INTEGER NOT NULL DEFAULT 1)"
        );

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS completed_tasks (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "user_id INTEGER NOT NULL," +
            "task_id INTEGER NOT NULL," +
            "reward REAL NOT NULL," +
            "completed_at TEXT DEFAULT CURRENT_TIMESTAMP)"
        );

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS transactions (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "user_id INTEGER NOT NULL," +
            "type TEXT NOT NULL," +
            "amount REAL NOT NULL," +
            "description TEXT," +
            "created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
        );

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS withdrawals (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "user_id INTEGER NOT NULL," +
            "amount REAL NOT NULL," +
            "upi_id TEXT NOT NULL," +
            "status TEXT NOT NULL DEFAULT 'pending'," +
            "created_at TEXT DEFAULT CURRENT_TIMESTAMP," +
            "processed_at TEXT)"
        );

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS ad_rewards (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "user_id INTEGER NOT NULL," +
            "transaction_id TEXT UNIQUE NOT NULL," +
            "reward_amount REAL NOT NULL," +
            "verified INTEGER NOT NULL DEFAULT 0," +
            "created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
        );
    }

    private void addTasks(SQLiteDatabase db) {

        Cursor c = db.rawQuery(
            "SELECT COUNT(*) FROM typing_tasks",
            null
        );

        int count = 0;

        if (c.moveToFirst()) {
            count = c.getInt(0);
        }

        c.close();

        if (count > 0) return;

        String[] tasks = {
            "Good communication helps people understand each other clearly.\n" +
            "Practice typing carefully and maintain accurate spelling.\n" +
            "Complete every task with patience and attention.",

            "Technology can make everyday activities faster and easier.\n" +
            "Learning new skills requires regular practice.\n" +
            "Consistent effort can improve your performance.",

            "Reading regularly can improve vocabulary and knowledge.\n" +
            "Typing accurately is useful for many digital tasks.\n" +
            "Focus on the text before submitting your work."
        };

        for (String task : tasks) {
            android.content.ContentValues values =
                new android.content.ContentValues();

            values.put("task_text", task);
            values.put("reward", TYPING_REWARD);
            values.put("active", 1);

            db.insert("typing_tasks", null, values);
        }
    }

    @Override
    public void onUpgrade(
        SQLiteDatabase db,
        int oldVersion,
        int newVersion
    ) {
        createTables(db);
        addTasks(db);
    }

    public JSONObject api(String path, JSONObject body) {

        try {

            if ("/api/register".equals(path)) {
                return register(body);
            }

            if ("/api/login".equals(path)) {
                return login(body);
            }

            if ("/api/logout".equals(path)) {
                return logout();
            }

            if ("/api/me".equals(path)) {
                return me();
            }

            if ("/api/wallet".equals(path)) {
                return wallet();
            }

            if ("/api/transactions".equals(path)) {
                return transactions();
            }

            if ("/api/task".equals(path)) {
                return getTask();
            }

            if ("/api/task/complete".equals(path)) {
                return completeTask(body);
            }

            if ("/api/withdraw".equals(path)) {
                return withdraw(body);
            }

            if ("/api/withdrawals".equals(path)) {
                return withdrawals();
            }

            if ("/api/status".equals(path)) {
                JSONObject result = new JSONObject();
                result.put("app", "SKR Earning App");
                result.put("status", "online");
                result.put("database", "connected");
                result.put("mode", "android-local");
                return result;
            }

            if ("/api/ad-reward/verify".equals(path)) {
                return error("Rewarded-ad verification is not configured yet.");
            }

            JSONObject result = new JSONObject();
            result.put("success", true);
            return result;

        } catch (Exception e) {

            JSONObject error = new JSONObject();

            try {
                error.put(
                    "error",
                    "Android API error: " +
                    (e.getMessage() == null ? "unknown error" : e.getMessage())
                );
            } catch (Exception ignored) {
            }

            return error;
        }
    }

    private JSONObject register(JSONObject body) throws Exception {

        String username = body.optString("username", "")
            .trim()
            .toLowerCase();

        String password = body.optString("password", "");

        if (username.length() < 3 || password.length() < 8) {
            return error(
                "Username must contain at least 3 characters and password at least 8 characters."
            );
        }

        SQLiteDatabase db = getWritableDatabase();

        Cursor existing = db.rawQuery(
            "SELECT id FROM accounts WHERE username = ?",
            new String[]{username}
        );

        boolean exists = existing.moveToFirst();
        existing.close();

        if (exists) {
            return error("Username already exists.");
        }

        db.beginTransaction();

        try {

            android.content.ContentValues account =
                new android.content.ContentValues();

            account.put("username", username);
            account.put("password_hash", hash(password));

            db.insertOrThrow(
                "accounts",
                null,
                account
            );

            android.content.ContentValues user =
                new android.content.ContentValues();

            user.put("username", username);
            user.put("balance", 0);

            db.insertOrThrow(
                "users",
                null,
                user
            );

            db.setTransactionSuccessful();

        } finally {
            db.endTransaction();
        }

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put(
            "message",
            "Account created successfully."
        );

        return result;
    }

    private JSONObject login(JSONObject body) throws Exception {

        String username = body.optString("username", "")
            .trim()
            .toLowerCase();

        String password = body.optString("password", "");

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT username, password_hash " +
            "FROM accounts WHERE username = ?",
            new String[]{username}
        );

        if (!cursor.moveToFirst()) {
            cursor.close();
            return error("Invalid username or password.");
        }

        String storedUsername =
            cursor.getString(
                cursor.getColumnIndexOrThrow("username")
            );

        String storedHash =
            cursor.getString(
                cursor.getColumnIndexOrThrow("password_hash")
            );

        cursor.close();

        if (!hash(password).equals(storedHash)) {
            return error("Invalid username or password.");
        }

        context.getSharedPreferences(
            "skr_session",
            Context.MODE_PRIVATE
        )
        .edit()
        .putString("username", storedUsername)
        .putBoolean("logged_in", true)
        .apply();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("username", storedUsername);

        return result;
    }

    private JSONObject logout() throws Exception {

        context.getSharedPreferences(
            "skr_session",
            Context.MODE_PRIVATE
        )
        .edit()
        .clear()
        .apply();

        JSONObject result = new JSONObject();
        result.put("success", true);

        return result;
    }

    private String currentUsername() {

        SharedPreferences preferences =
            context.getSharedPreferences(
                "skr_session",
                Context.MODE_PRIVATE
            );

        if (!preferences.getBoolean("logged_in", false)) {
            return null;
        }

        return preferences.getString("username", null);
    }

    private JSONObject me() throws Exception {

        String username = currentUsername();

        if (username == null) {
            return error("Please log in.");
        }

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT id, username, balance " +
            "FROM users WHERE username = ?",
            new String[]{username}
        );

        if (!cursor.moveToFirst()) {
            cursor.close();
            return error("User not found.");
        }

        int id = cursor.getInt(
            cursor.getColumnIndexOrThrow("id")
        );

        double balance = cursor.getDouble(
            cursor.getColumnIndexOrThrow("balance")
        );

        cursor.close();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("id", id);
        result.put("username", username);
        result.put("balance", balance);

        return result;
    }

    private int currentUserId() {

        String username = currentUsername();

        if (username == null) {
            return -1;
        }

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT id FROM users WHERE username = ?",
            new String[]{username}
        );

        if (!cursor.moveToFirst()) {
            cursor.close();
            return -1;
        }

        int id = cursor.getInt(0);
        cursor.close();

        return id;
    }

    private double todayEarnings(int userId) {

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT COALESCE(SUM(amount), 0) " +
            "FROM transactions " +
            "WHERE user_id = ? " +
            "AND type IN ('typing_reward', 'ad_reward') " +
            "AND date(created_at, 'localtime') = date('now', 'localtime')",
            new String[]{String.valueOf(userId)}
        );

        double result = 0;

        if (cursor.moveToFirst()) {
            result = cursor.getDouble(0);
        }

        cursor.close();

        return result;
    }

    private JSONObject wallet() throws Exception {

        int userId = currentUserId();

        if (userId < 0) {
            return error("Please log in.");
        }

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT balance FROM users WHERE id = ?",
            new String[]{String.valueOf(userId)}
        );

        if (!cursor.moveToFirst()) {
            cursor.close();
            return error("User not found.");
        }

        double balance = cursor.getDouble(0);
        cursor.close();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("balance", balance);
        result.put("todayEarnings", todayEarnings(userId));
        result.put("dailyLimit", DAILY_LIMIT);

        return result;
    }

    private JSONObject transactions() throws Exception {

        int userId = currentUserId();

        if (userId < 0) {
            return error("Please log in.");
        }

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT id, type, amount, description, created_at " +
            "FROM transactions " +
            "WHERE user_id = ? " +
            "ORDER BY id DESC LIMIT 100",
            new String[]{String.valueOf(userId)}
        );

        JSONArray array = new JSONArray();

        while (cursor.moveToNext()) {

            JSONObject item = new JSONObject();

            item.put("id", cursor.getInt(0));
            item.put("type", cursor.getString(1));
            item.put("amount", cursor.getDouble(2));

            String description = cursor.isNull(3)
                ? ""
                : cursor.getString(3);

            item.put("description", description);
            item.put("created_at", cursor.getString(4));

            array.put(item);
        }

        cursor.close();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("transactions", array);

        return result;
    }

    private JSONObject getTask() throws Exception {

        int userId = currentUserId();

        if (userId < 0) {
            return error("Please log in.");
        }

        double today = todayEarnings(userId);

        if (today >= DAILY_LIMIT) {
            return error(
                "You have reached today's ₹50 earning limit."
            );
        }

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT id, task_text, reward " +
            "FROM typing_tasks " +
            "WHERE active = 1 " +
            "AND id NOT IN (" +
            "SELECT task_id FROM completed_tasks " +
            "WHERE user_id = ? " +
            "AND date(completed_at, 'localtime') = date('now', 'localtime')" +
            ") " +
            "ORDER BY id LIMIT 1",
            new String[]{String.valueOf(userId)}
        );

        if (!cursor.moveToFirst()) {
            cursor.close();
            return error("No typing tasks are available.");
        }

        int id = cursor.getInt(0);
        String text = cursor.getString(1);
        double reward = cursor.getDouble(2);

        cursor.close();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("taskId", id);
        result.put("text", text);
        result.put("reward", reward);

        return result;
    }

    private JSONObject completeTask(JSONObject body) throws Exception {

        int userId = currentUserId();

        if (userId < 0) {
            return error("Please log in.");
        }

        int taskId = body.optInt("taskId", -1);
        String typedText = body.optString("typedText", "");

        if (taskId <= 0 || typedText.length() == 0) {
            return error("Invalid task submission.");
        }

        SQLiteDatabase db = getWritableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT id, task_text, reward " +
            "FROM typing_tasks " +
            "WHERE id = ? AND active = 1",
            new String[]{String.valueOf(taskId)}
        );

        if (!cursor.moveToFirst()) {
            cursor.close();
            return error("Task not found.");
        }

        String taskText = cursor.getString(1);
        double reward = cursor.getDouble(2);

        cursor.close();

        if (!typedText.trim().equals(taskText.trim())) {
            return error("Typing does not match the task.");
        }

        double today = todayEarnings(userId);

        if (today + TYPING_REWARD > DAILY_LIMIT) {
            return error(
                "This task would exceed today's ₹50 limit."
            );
        }

        Cursor already = db.rawQuery(
            "SELECT id FROM completed_tasks " +
            "WHERE user_id = ? AND task_id = ? " +
            "AND date(completed_at, 'localtime') = date('now', 'localtime')",
            new String[]{
                String.valueOf(userId),
                String.valueOf(taskId)
            }
        );

        boolean completed = already.moveToFirst();
        already.close();

        if (completed) {
            return error(
                "This task has already been completed today."
            );
        }

        db.beginTransaction();

        try {

            android.content.ContentValues completedValues =
                new android.content.ContentValues();

            completedValues.put("user_id", userId);
            completedValues.put("task_id", taskId);
            completedValues.put("reward", TYPING_REWARD);

            db.insertOrThrow(
                "completed_tasks",
                null,
                completedValues
            );

            db.execSQL(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                new Object[]{TYPING_REWARD, userId}
            );

            android.content.ContentValues transaction =
                new android.content.ContentValues();

            transaction.put("user_id", userId);
            transaction.put("type", "typing_reward");
            transaction.put("amount", TYPING_REWARD);
            transaction.put(
                "description",
                "Typing task #" + taskId + " completed"
            );

            db.insertOrThrow(
                "transactions",
                null,
                transaction
            );

            db.setTransactionSuccessful();

        } finally {
            db.endTransaction();
        }

        double newBalance = 0;

        Cursor balanceCursor = db.rawQuery(
            "SELECT balance FROM users WHERE id = ?",
            new String[]{String.valueOf(userId)}
        );

        if (balanceCursor.moveToFirst()) {
            newBalance = balanceCursor.getDouble(0);
        }

        balanceCursor.close();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("reward", TYPING_REWARD);
        result.put("balance", newBalance);
        result.put(
            "todayEarnings",
            todayEarnings(userId)
        );
        result.put("dailyLimit", DAILY_LIMIT);

        return result;
    }

    private JSONObject withdraw(JSONObject body) throws Exception {

        int userId = currentUserId();

        if (userId < 0) {
            return error("Please log in.");
        }

        double amount = body.optDouble("amount", -1);
        String upiId = body.optString("upiId", "").trim();

        if (
            amount < 10 ||
            Math.round(amount * 100) !=
            amount * 100
        ) {
            return error(
                "Withdrawal must be at least ₹10 and use at most 2 decimal places."
            );
        }

        if (!Pattern.matches(
            "^[\\w.-]+@[\\w.-]+$",
            upiId
        )) {
            return error("Please enter a valid UPI ID.");
        }

        SQLiteDatabase db = getWritableDatabase();

        Cursor balanceCursor = db.rawQuery(
            "SELECT balance FROM users WHERE id = ?",
            new String[]{String.valueOf(userId)}
        );

        if (!balanceCursor.moveToFirst()) {
            balanceCursor.close();
            return error("User not found.");
        }

        double balance = balanceCursor.getDouble(0);
        balanceCursor.close();

        if (amount > balance) {
            return error("Insufficient wallet balance.");
        }

        Cursor pending = db.rawQuery(
            "SELECT id FROM withdrawals " +
            "WHERE user_id = ? AND status = 'pending'",
            new String[]{String.valueOf(userId)}
        );

        boolean hasPending = pending.moveToFirst();
        pending.close();

        if (hasPending) {
            return error(
                "You already have a pending withdrawal."
            );
        }

        long withdrawalId;

        db.beginTransaction();

        try {

            android.content.ContentValues withdrawal =
                new android.content.ContentValues();

            withdrawal.put("user_id", userId);
            withdrawal.put("amount", amount);
            withdrawal.put("upi_id", upiId);
            withdrawal.put("status", "pending");

            withdrawalId = db.insertOrThrow(
                "withdrawals",
                null,
                withdrawal
            );

            db.execSQL(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                new Object[]{amount, userId}
            );

            android.content.ContentValues transaction =
                new android.content.ContentValues();

            transaction.put("user_id", userId);
            transaction.put("type", "withdrawal");
            transaction.put("amount", -amount);
            transaction.put(
                "description",
                "Withdrawal request #" + withdrawalId
            );

            db.insertOrThrow(
                "transactions",
                null,
                transaction
            );

            db.setTransactionSuccessful();

        } finally {
            db.endTransaction();
        }

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("withdrawalId", withdrawalId);
        result.put("amount", amount);
        result.put("status", "pending");
        result.put(
            "message",
            "Withdrawal request submitted."
        );

        return result;
    }

    private JSONObject withdrawals() throws Exception {

        int userId = currentUserId();

        if (userId < 0) {
            return error("Please log in.");
        }

        SQLiteDatabase db = getReadableDatabase();

        Cursor cursor = db.rawQuery(
            "SELECT id, amount, upi_id, status, " +
            "created_at, processed_at " +
            "FROM withdrawals " +
            "WHERE user_id = ? " +
            "ORDER BY id DESC",
            new String[]{String.valueOf(userId)}
        );

        JSONArray array = new JSONArray();

        while (cursor.moveToNext()) {

            JSONObject item = new JSONObject();

            item.put("id", cursor.getInt(0));
            item.put("amount", cursor.getDouble(1));
            item.put("upi_id", cursor.getString(2));
            item.put("status", cursor.getString(3));
            item.put("created_at", cursor.getString(4));

            if (cursor.isNull(5)) {
                item.put("processed_at", JSONObject.NULL);
            } else {
                item.put("processed_at", cursor.getString(5));
            }

            array.put(item);
        }

        cursor.close();

        JSONObject result = new JSONObject();

        result.put("success", true);
        result.put("withdrawals", array);

        return result;
    }

    private JSONObject error(String message) throws Exception {

        JSONObject result = new JSONObject();
        result.put("error", message);

        return result;
    }

    public static String hash(String value) {

        try {

            MessageDigest md =
                MessageDigest.getInstance("SHA-256");

            byte[] bytes =
                md.digest(value.getBytes("UTF-8"));

            StringBuilder result =
                new StringBuilder();

            for (byte b : bytes) {
                result.append(
                    String.format("%02x", b)
                );
            }

            return result.toString();

        } catch (Exception e) {
            return "";
        }
    }
}
