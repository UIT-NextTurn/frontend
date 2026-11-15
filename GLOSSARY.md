# NextTurn

A multi-tenant queue management and appointment booking platform uniting advance reservations and walk-in reception for service businesses.

## Language

### Platform & Tenancy

**Platform**:
A deployed NextTurn instance owned and operated by the Platform Owner (Vietnamese UI: *Nền tảng*).
_Avoid_: System, App

**Platform Owner**:
The organization that owns and commissions the Platform.
_Avoid_: Customer (as acquirer), Sponsor, Client

**Platform Administrator**:
Platform Owner personnel responsible for approving, configuring, and monitoring Tenants across the Platform (Vietnamese UI: *Quản trị viên nền tảng*).
_Avoid_: SuperAdmin, System Admin

**Business**:
A service organization using the Platform to manage customer appointments and walk-in queues.
_Avoid_: Company, Merchant, Store

**Tenant**:
An isolated operational workspace representing a single Business on the Platform, currently mapped one-to-one with a Business (Vietnamese UI: *Cơ sở*; Tenant identifier label: *Mã cơ sở*).
_Avoid_: Organization, Workspace, Account

**Tenant Registration**:
A public application submitted by a Business to join the Platform, creating a Tenant that a Platform Administrator must approve before it becomes active.
_Avoid_: Signup, tenant signup

### Access & Integration

**Widget**:
The embeddable booking interface a Business integrates into its own website so End-users can book Services and join Queues there.
_Avoid_: Plugin, embed

**Widget Key**:
The public identifier a Widget presents to the Platform, paired with a non-client-exposed Widget Secret Key.
_Avoid_: Public key, API key

**Identity Provider**:
An external authentication provider (Google, Microsoft Entra, OIDC, or SAML) linked to a Tenant so its personnel can sign in with corporate credentials.
_Avoid_: SSO provider

### Tenant Personnel

**Tenant Administrator**:
Business personnel with full administrative authority over a Tenant's services, staff, shift schedules, counters, and settings (Vietnamese UI: *Quản trị viên cơ sở*).
_Avoid_: Business Owner, Org Admin

**Tenant Staff**:
All Business personnel recorded within a Tenant, encompassing the Tenant Administrator, Counter Staff, and Service Staff (Vietnamese UI: *Nhân sự*).
_Avoid_: Employee, Worker

**Counter Staff**:
Tenant Staff who operate reception Counters to check in Booking Customers, issue or advance Queue Tickets, and serve End-users (Vietnamese UI: *Nhân viên quầy*).
_Avoid_: Receptionist, Desk Agent

**Service Staff**:
Rostered Tenant Staff assigned to Services in Shift Schedules strictly as an internal scheduling resource without Platform login or customer-facing selection.
_Avoid_: Specialist, Provider, Doctor

**Counter**:
A physical reception station configured for specific Services and claimed by Counter Staff during active service operations.
_Avoid_: Desk, Window, Booth

### End-users & Customers

**Customer**:
A person visiting or reserving Services at a Business, encompassing both Walk-in Customers and Booking Customers.
_Avoid_: Client, Patron, Guest

**End-user**:
Collective term for Walk-in Customers and Booking Customers interacting with a Tenant's customer-facing booking and queue experiences.
_Avoid_: Consumer, Visitor

**Walk-in Customer**:
A Customer who joins a live Service Queue on-site or online without a prior Appointment.
_Avoid_: Walk-in, Unscheduled Visitor

**Booking Customer**:
A Customer who reserves a Service Time Slot in advance via an Appointment.
_Avoid_: Booking User, Appointee

### Services, Scheduling & Queuing

**Service**:
A defined offering provided by a Business with a standard duration and price, acting as the pooled unit of Time Slot capacity and live queuing.
_Avoid_: Offering, Procedure

**Shift Schedule**:
A Tenant's configurable work-assignment matrix pivoting across staff, services, dates or hours, and Counters to allocate staffing capacity.
_Avoid_: Roster, Timetable

**Time Slot**:
A discrete bookable time window matching a Service's standard duration, whose capacity reflects active staff scheduled to cover it.
_Avoid_: Slot, Window

**Slot Holding**:
A temporary exclusive reservation of a Time Slot during End-user checkout, released automatically on expiry or manually before an Appointment is confirmed.
_Avoid_: Hold, reservation

**Appointment**:
A confirmed advance reservation for a specific Service and Time Slot held by a Booking Customer prior to queue check-in.
_Avoid_: Booking, Reservation

**Queue**:
An ordered waiting stream scoped per Service that ingests both Walk-in Customers and checked-in Booking Customers.
_Avoid_: Line, Waitlist

**Queue Ticket**:
A numbered turn issued to an End-user in a Service Queue, occupying the waiting, calling, serving, completed, or no-show states and moved between them by counter operations such as hold, skip, and transfer.
_Avoid_: Token, Number, Slip
