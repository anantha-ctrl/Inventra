<?php
class SettingController extends Controller
{
    private Setting $model;

    public function __construct()
    {
        $this->model = new Setting();
    }

    public function show(Request $req): void
    {
        // Viewable by all logged-in roles
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        Response::success($this->model->get());
    }

    public function update(Request $req): void
    {
        // Editable only by Admin
        $this->authorize($req, ['Admin']);

        $this->validate($req, [
            'company_name'        => 'required|max:150',
            'company_email'       => 'email',
            'low_stock_threshold' => 'numeric|min:1',
            'date_format'         => 'max:20',
            'enable_alerts'       => 'numeric',
            'enable_email'        => 'numeric',
        ]);

        $success = $this->model->saveSettings([
            'company_name'        => $req->input('company_name'),
            'company_email'       => $req->input('company_email'),
            'company_phone'       => $req->input('company_phone'),
            'currency'            => $req->input('currency'),
            'currency_symbol'     => $req->input('currency_symbol'),
            'low_stock_threshold' => (int) $req->input('low_stock_threshold'),
            'timezone'            => $req->input('timezone'),
            'date_format'         => $req->input('date_format', 'YYYY-MM-DD'),
            'enable_alerts'       => (int) $req->input('enable_alerts', 1),
            'enable_email'        => (int) $req->input('enable_email', 0),
            'role_permissions'    => $req->input('role_permissions'),
        ]);

        if ($success) {
            ActivityLogger::log($this->userId($req), 'update', 'settings', "Updated global system settings");
            Response::success(null, 'Settings updated successfully');
        } else {
            Response::error('Failed to update settings', 500);
        }
    }
}
