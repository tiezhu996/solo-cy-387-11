from django.urls import path

from app.apps.properties.views import PropertyListView
from app.apps.booking.views import BookingCreateView
from app.apps.contract.views import ContractListView
from app.apps.repair.ticket_views import (
    RepairAcceptView,
    RepairCompleteView,
    RepairTicketDetailView,
)
from app.apps.repair.transfer_views import (
    TransferAcceptView,
    TransferDetailView,
    TransferListCreateView,
    TransferRejectView,
)
from app.apps.repair.views import RepairTicketListView
from app.apps.users.views import StaffListView

urlpatterns = [
    path('api/properties/', PropertyListView.as_view()),
    path('api/bookings/', BookingCreateView.as_view()),
    path('api/contracts/', ContractListView.as_view()),

    # 物业人员
    path('api/staff/', StaffListView.as_view()),

    # 报修工单（POST 提交保持原入口）
    path('api/repairs/', RepairTicketListView.as_view()),
    path('api/repairs/<int:ticket_id>/', RepairTicketDetailView.as_view()),
    path('api/repairs/<int:ticket_id>/accept', RepairAcceptView.as_view()),
    path('api/repairs/<int:ticket_id>/complete', RepairCompleteView.as_view()),

    # 工单转派
    path('api/repairs/<int:ticket_id>/transfers/', TransferListCreateView.as_view()),
    path('api/transfers/<int:transfer_id>/', TransferDetailView.as_view()),
    path('api/transfers/<int:transfer_id>/accept', TransferAcceptView.as_view()),
    path('api/transfers/<int:transfer_id>/reject', TransferRejectView.as_view()),
]
