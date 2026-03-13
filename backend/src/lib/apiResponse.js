export function ok(data, message = "Success", status = 200) {
  return { data, message, status };
}

export function fail(message, status = 400, errors) {
  return { message, status, errors };
}
