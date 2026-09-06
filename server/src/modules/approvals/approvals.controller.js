const approvalsService = require('./approvals.service');
const { APIResponse } = require('../../utils/apiResponse');

class ApprovalsController {
  async getRequests(req, res, next) {
    try {
      const result = await approvalsService.listRequests(req.user, req.query);
      return APIResponse.paginated(res, 'Registration requests retrieved', result.requests, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async resolveRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const result = await approvalsService.resolveRequest(requestId, req.body, req.user);
      return APIResponse.success(res, `Registration request ${result.status} successfully`, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ApprovalsController();
