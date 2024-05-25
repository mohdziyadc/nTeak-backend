// Only Deprecated Event Subscriber works with medusa-sendgrid-plugin

class UserSignupSubscriber {
  constructor({ eventBusService, sendgridService }) {
    eventBusService.subscribe(
      "customer.created",
      async (data) => {
        console.log(
          "Template id from event handler: " +
            process.env.SENDGRID_SIGN_UP_SUCCESS_ID
        );
        sendgridService.sendEmail({
          templateId: process.env.SENDGRID_SIGN_UP_SUCCESS_ID,
          from: process.env.SENDGRID_FROM,
          to: data.email,
          dynamic_template_data: {
            first_name: data.first_name,
          },
        });
      },
      {
        subscriberId: "customer-created-subscriber",
      }
    );
  }
}

export default UserSignupSubscriber;
