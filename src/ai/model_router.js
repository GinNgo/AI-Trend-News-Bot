const modelCooldowns = {};

/**
 * Returns a list of models prioritized by the task type,
 * skipping any models that are currently in cooldown (blacklisted).
 */
function getModelsForTask(taskType, envDefaultModel = null) {
  // Định nghĩa sở trường của từng model
  let preferredModels = [];

  switch (taskType) {
    case 'FILTER':
      // Tác vụ quét/lọc tin: Cần siêu tốc độ, tiết kiệm quota nhất.
      preferredModels = [
        "gemini-3.5-flash-lite", // 500 RPD, 15 RPM
        "gemini-3.1-flash-lite", // 500 RPD, 15 RPM
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.0-flash",
        "gemini-2.5-flash"
      ];
      break;

    case 'EXTRACT':
      // Tác vụ bóc tách sự kiện/Facts
      preferredModels = [
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.7-flash",
        "gemini-2.5-pro"
      ];
      break;

    case 'WRITE':
      // Tác vụ viết kịch bản sáng tạo
      preferredModels = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-2.5-flash-lite"
      ];
      break;

    default:
      // Tác vụ chung chung
      preferredModels = [
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-2.5-flash-lite"
      ];
      break;
  }

  // Đưa model mặc định cấu hình lên đầu (nếu có)
  if (envDefaultModel && !preferredModels.includes(envDefaultModel)) {
    preferredModels.unshift(envDefaultModel);
  } else if (envDefaultModel) {
    // Đảo model mặc định lên vị trí số 1
    preferredModels = [envDefaultModel, ...preferredModels.filter(m => m !== envDefaultModel)];
  }

  // Bỏ qua các model đang bị dính "Blacklist" (Cooldown) do lỗi 429
  const now = Date.now();
  const availableModels = preferredModels.filter(m => {
    if (modelCooldowns[m] && modelCooldowns[m] > now) {
      return false; // Skip
    }
    return true;
  });

  // Nếu tất cả các model đều bị block, trả về toàn bộ danh sách ban đầu để thử lại từ đầu
  if (availableModels.length === 0) {
    return preferredModels;
  }

  return availableModels;
}

/**
 * Đánh dấu một model vào Blacklist (phong tỏa) tạm thời trong khoảng thời gian nhất định (Mặc định 60s)
 */
function blockModel(modelName, waitSecs = 60) {
  modelCooldowns[modelName] = Date.now() + (waitSecs * 1000);
}

/**
 * Kiểm tra xem model có đang bị block không (thời gian chờ còn bao nhiêu giây)
 */
function getModelBlockTimeRemaining(modelName) {
  if (modelCooldowns[modelName] && modelCooldowns[modelName] > Date.now()) {
    return Math.ceil((modelCooldowns[modelName] - Date.now()) / 1000);
  }
  return 0;
}

module.exports = {
  getModelsForTask,
  blockModel,
  getModelBlockTimeRemaining
};
