package com.uninter.salon.common;

import java.util.regex.Pattern;

public final class PhoneUtil {

    // Area code without leading 0 + 9-digit mobile or 8-digit landline
    private static final Pattern VALID = Pattern.compile("^[1-9][0-9](9[0-9]{8}|[0-9]{8})$");

    private PhoneUtil() {
    }

    /** Keeps digits only; drops a leading 55 only when 12 or 13 digits remain. */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String digits = raw.replaceAll("\\D", "");
        if ((digits.length() == 12 || digits.length() == 13) && digits.startsWith("55")) {
            digits = digits.substring(2);
        }
        return digits;
    }

    public static boolean isValid(String normalized) {
        return normalized != null && VALID.matcher(normalized).matches();
    }

    /** Returns the normalised digits or throws 400 "Invalid phone number". */
    public static String requireValid(String raw) {
        String normalized = normalize(raw);
        if (!isValid(normalized)) {
            throw ApiException.badRequest("Invalid phone number");
        }
        return normalized;
    }

    /** Normalised digits of a search term (may be empty). */
    public static String searchDigits(String term) {
        return normalize(term);
    }
}