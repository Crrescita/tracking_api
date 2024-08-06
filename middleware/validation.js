function validateFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (!value) {
      return { valid: false, message: `${key.replace("_", " ")} is required` };
    }
  }
  return { valid: true };
}

global.validateFields = validateFields;
